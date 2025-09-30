import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { leadId } = await req.json();

    if (!leadId) {
      return new Response(
        JSON.stringify({ error: "leadId is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select(`
        *,
        affiliate:affiliates(*),
        offer:offers(
          *,
          advertiser:advertisers(*)
        ),
        traffic_log:traffic_logs(*)
      `)
      .eq("id", leadId)
      .maybeSingle();

    if (leadError || !lead) {
      return new Response(
        JSON.stringify({ error: "Lead not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (lead.status !== "pending") {
      return new Response(
        JSON.stringify({ message: "Lead already processed", status: lead.status }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: mapping, error: mappingError } = await supabase
      .from("mappings")
      .select("*, advertiser:advertisers(*)")
      .eq("affiliate_id", lead.affiliate_id)
      .eq("offer_id", lead.offer_id)
      .eq("enabled", true)
      .maybeSingle();

    if (mappingError || !mapping) {
      await supabase
        .from("leads")
        .update({ status: "no_mapping", updated_at: new Date().toISOString() })
        .eq("id", leadId);

      return new Response(
        JSON.stringify({ message: "No mapping found", status: "no_mapping" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: fieldMappings } = await supabase
      .from("field_mappings")
      .select("*")
      .eq("advertiser_id", mapping.advertiser.id)
      .eq("allowlist", true);

    const payload: any = {};
    const rawPayload = lead.traffic_log.raw_payload;
    const standardFields = {
      email: lead.email,
      phone: lead.phone,
      first_name: lead.first_name,
      last_name: lead.last_name,
      country: lead.country,
    };

    if (fieldMappings && fieldMappings.length > 0) {
      for (const fm of fieldMappings) {
        const value = rawPayload[fm.source_field] || standardFields[fm.source_field as keyof typeof standardFields];
        if (value !== undefined && value !== null) {
          payload[fm.target_field] = value;
        }
      }
    } else {
      Object.entries(standardFields).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          payload[key] = value;
        }
      });
    }

    const requestPayload = {
      az_tx_id: lead.az_tx_id,
      ...payload,
    };

    const endpointUrl = mapping.forward_url || mapping.advertiser.endpoint_url;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "AZLeads/1.0",
    };

    if (mapping.advertiser.endpoint_secret) {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const bodyString = JSON.stringify(requestPayload);
      const encoder = new TextEncoder();
      const data = encoder.encode(`${timestamp}:${bodyString}`);
      const keyData = encoder.encode(mapping.advertiser.endpoint_secret);
      const cryptoKey = await crypto.subtle.importKey(
        "raw",
        keyData,
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
      );
      const signature = await crypto.subtle.sign("HMAC", cryptoKey, data);
      const hashArray = Array.from(new Uint8Array(signature));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
      
      headers["X-Signature"] = `sha256=${hashHex}`;
      headers["X-Signature-Timestamp"] = timestamp;
    }

    const attemptNo = 1;

    try {
      const response = await fetch(endpointUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(requestPayload),
      });

      const responseData = await response.text();
      let responseJson;
      try {
        responseJson = JSON.parse(responseData);
      } catch {
        responseJson = { body: responseData };
      }

      await supabase.from("forward_logs").insert({
        lead_id: leadId,
        attempt_no: attemptNo,
        request: { url: endpointUrl, headers, body: requestPayload },
        response: {
          status: response.status,
          body: responseJson,
        },
        status_code: response.status,
      });

      if (response.status >= 200 && response.status < 300) {
        await supabase
          .from("leads")
          .update({
            status: "forwarded",
            advertiser_id: mapping.advertiser.id,
            advertiser_response: responseJson,
            updated_at: new Date().toISOString(),
          })
          .eq("id", leadId);

        return new Response(
          JSON.stringify({ message: "Lead forwarded successfully", status: "forwarded" }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      } else {
        await supabase
          .from("leads")
          .update({
            status: "forward_failed",
            advertiser_id: mapping.advertiser.id,
            advertiser_response: responseJson,
            updated_at: new Date().toISOString(),
          })
          .eq("id", leadId);

        return new Response(
          JSON.stringify({ 
            message: "Forward failed", 
            status: "forward_failed",
            advertiserStatus: response.status,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    } catch (error: any) {
      await supabase.from("forward_logs").insert({
        lead_id: leadId,
        attempt_no: attemptNo,
        request: { url: endpointUrl, headers, body: requestPayload },
        response: { error: error.message },
        status_code: null,
      });

      await supabase
        .from("leads")
        .update({
          status: "forward_failed",
          advertiser_id: mapping.advertiser.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", leadId);

      return new Response(
        JSON.stringify({ 
          message: "Forward failed with error", 
          status: "forward_failed",
          error: error.message,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
  } catch (error: any) {
    console.error("Edge function error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});