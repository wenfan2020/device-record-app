import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const BAIDU_API_KEY = Deno.env.get("BAIDU_OCR_API_KEY") || "";
const BAIDU_SECRET_KEY = Deno.env.get("BAIDU_OCR_SECRET_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function getBaiduToken(): Promise<string> {
  const url = `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${BAIDU_API_KEY}&client_secret=${BAIDU_SECRET_KEY}`;
  const res = await fetch(url, { method: "POST" });
  const data = await res.json();
  if (!data.access_token) throw new Error("获取 Baidu token 失败: " + JSON.stringify(data));
  return data.access_token;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { image } = await req.json();
    if (!image) {
      return new Response(JSON.stringify({ error: "缺少 image 参数" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = await getBaiduToken();
    const ocrUrl = `https://aip.baidubce.com/rest/2.0/ocr/v1/accurate_basic?access_token=${token}`;
    
    const formBody = new URLSearchParams();
    formBody.append("image", image);
    formBody.append("language_type", "CHN_ENG");
    
    const ocrRes = await fetch(ocrUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formBody.toString(),
    });

    const result = await ocrRes.json();

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
