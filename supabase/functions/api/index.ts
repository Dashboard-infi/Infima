import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-app-version",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function getBearerToken(req: Request) {
  const auth = req.headers.get("Authorization") || "";
  if (auth.startsWith("Bearer ")) {
    return auth.slice(7);
  }
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname;

  if (req.method === "GET" && (path === "/version" || path === "/api/version")) {
    return json({
      current_version: Deno.env.get("CURRENT_SERVER_VERSION") || "1.0.0",
      minimum_required_version: Deno.env.get("MINIMUM_REQUIRED_VERSION") || "1.0.0",
    });
  }

  if (req.method === "GET" && (path === "/env-test" || path === "/api/env-test")) {
    return json({
      host: Deno.env.get("DB_HOST") ?? null,
      port: Deno.env.get("DB_PORT") ?? null,
      user: Deno.env.get("DB_USER") ?? null,
      database: Deno.env.get("DB_NAME") ?? null,
      hasPassword: Boolean(Deno.env.get("DB_PASSWORD")),
      hasCa: Boolean(Deno.env.get("DB_SSL_CA")),
    });
  }

  if (req.method === "POST" && (path === "/auth/register" || path === "/api/auth/register")) {
    try {
      const body = await req.json();

      return json({
        message: "Inscription de test reussie",
        user: {
          id: 1,
          nom: body.nom || "Test",
          prenom: body.prenom || "Utilisateur",
          email: body.email || "test@example.com",
        },
        token: "mock-register-token",
      });
    } catch {
      return json({ error: "Corps JSON invalide" }, 400);
    }
  }

  if (req.method === "POST" && (path === "/auth/login" || path === "/api/auth/login")) {
    try {
      const body = await req.json();

      if (!body.email || !body.mot_de_passe) {
        return json({ error: "Email et mot de passe requis" }, 400);
      }

      return json({
        token: "mock-login-token",
        user: {
          id: 1,
          nom: "Cabinet",
          prenom: "Test",
          email: body.email,
          role: "infirmier",
        },
      });
    } catch {
      return json({ error: "Corps JSON invalide" }, 400);
    }
  }

  if (req.method === "GET" && (path === "/profil" || path === "/api/profil")) {
    const token = getBearerToken(req);

    if (!token) {
      return json({ error: "Token manquant" }, 401);
    }

    return json({
      id: 1,
      nom: "Cabinet",
      prenom: "Test",
      email: "test@infima.app",
      telephone: "0600000000",
      adresse: "1 rue de test",
      ville: "Toulouse",
      code_postal: "31000",
      km_compteur: 1250,
    });
  }

  return json(
    {
      error: "Route non prise en charge",
      path,
      method: req.method,
    },
    404,
  );
});