// ads.txt declara qué cuentas pueden vender anuncios en el dominio. AdSense avisa si falta.
export const dynamic = "force-static";

export function GET() {
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
  const body = client
    ? `google.com, ${client.replace(/^ca-/, "")}, DIRECT, f08c47fec0942fa0\n`
    : "# AdSense aún no configurado (NEXT_PUBLIC_ADSENSE_CLIENT)\n";
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
