import express from "express";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const app = express();
app.use(express.json({ limit: "1mb" }));

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Prompt base
function buildSystemPrompt() {
  return `
Você é um motor profissional de criação de conteúdo para YouTube especializado em SEO, retenção e conversão.
Crie títulos, roteiro para teleprompter, descrição e tags em PT-BR.
Use linguagem natural, simples e direta. Nada robótico.
Não invente dados específicos como se fossem fatos.
`;
}

// Função de prompt para 1 vídeo ou funil 3 vídeos
function buildUserPrompt({ tema, publico, keyword, mode, offer_name, offer_link, offer_cta }) {
  const offerBlock = `
DADOS DA OFERTA
- Nome da oferta: ${offer_name || "NÃO INFORMADO"}
- Link da oferta: ${offer_link || "NÃO INFORMADO"}
- CTA principal: ${offer_cta || "NÃO INFORMADO"}

REGRAS DE VENDA (CTAs)
- Se a oferta e link estiverem informados, inclua CTAs de venda naturais.
- Evite parecer anúncio. Use como recomendação prática.
- Inclua CTA de venda em 3 momentos:
  1) Depois do Passo 1 (bem leve)
  2) No meio (depois de entregar valor forte)
  3) No final (mais direto)
- Na descrição, coloque o link da oferta nas primeiras linhas, com CTA claro.
- Não prometa resultados garantidos.
`;

  const base = `
DADOS DO USUÁRIO
- Tema do vídeo: ${tema}
- Público alvo: ${publico}
- Palavra-chave principal: ${keyword}

REGRAS GERAIS
- Linguagem natural, como conversa com um amigo.
- Tempo alvo por vídeo: 4 a 7 minutos.
- Não invente dados específicos; se usar números, trate como exemplo.

REGRA CRÍTICA DE SEO
- A palavra-chave "${keyword}" deve aparecer o MÁXIMO de vezes possível, sem ficar forçado.
- Espalhe no gancho, apresentação, começo de passos, explicações e final.
- A descrição também deve repetir a keyword o máximo possível com naturalidade.

${offerBlock}
`;

  if (mode === "funnel3") {
    return `
${base}

TAREFA
Gere 3 VÍDEOS NO FORMATO FUNIL, UM LINKANDO PARA O OUTRO.

Regras do FUNIL:
- Vídeo 1: atrair (topo/meio). Promessa forte + problema + visão geral.
- Vídeo 2: aprofundar (meio). Passo a passo + prova/autoridade + quebra de objeções.
- Vídeo 3: fechar (fundo). Review/vale a pena/comparativo + CTA mais direto.

Ligação entre vídeos:
- No final do Vídeo 1, crie uma ponte clara para o Vídeo 2 com frase pronta.
- No final do Vídeo 2, crie uma ponte clara para o Vídeo 3 com frase pronta.
- No começo do Vídeo 2, faça uma lembrança de 1 linha do Vídeo 1.
- No começo do Vídeo 3, faça uma lembrança de 1 linha do Vídeo 2.
- Em cada vídeo, inclua 2 CTAs leves (inscrever/like/comentar) e 1 CTA para “assistir o próximo vídeo”.

REGRAS DE CTA NO FUNIL
- Vídeo 1: CTA leve e curioso.
- Vídeo 2: CTA com lógica e atalho.
- Vídeo 3: CTA direto.

Entregue para CADA VÍDEO:
1) 10 títulos SEO (marque 1 como recommended)
2) Roteiro completo para teleprompter (com seções)
3) Descrição SEO (keyword repetida naturalmente ao máximo)
4) 20 tags

FORMATO DE SAÍDA
Responda APENAS em JSON válido:
{
  "funnel": [
    {
      "video_number": 1,
      "role": "topo/meio",
      "titles": [{"text":"", "recommended": false}],
      "script": {
        "target_minutes": "",
        "teleprompter_text": "",
        "sections": [{"name":"", "content":""}],
        "bridge_to_next_video": ""
      },
      "description": "",
      "tags": []
    },
    {
      "video_number": 2,
      "role": "meio",
      "titles": [{"text":"", "recommended": false}],
      "script": {
        "target_minutes": "",
        "teleprompter_text": "",
        "sections": [{"name":"", "content":""}],
        "bridge_to_next_video": ""
      },
      "description": "",
      "tags": []
    },
    {
      "video_number": 3,
      "role": "fundo",
      "titles": [{"text":"", "recommended": false}],
      "script": {
        "target_minutes": "",
        "teleprompter_text": "",
        "sections": [{"name":"", "content":""}],
        "bridge_to_next_video": ""
      },
      "description": "",
      "tags": []
    }
  ]
}
`;
  }

  return `
${base}

TAREFA
Gere um pacote completo com:
1) 10 títulos SEO (marque 1 como recommended)
2) Roteiro completo para teleprompter (com seções)
3) Descrição SEO (keyword repetida naturalmente ao máximo)
4) 20 tags

FORMATO DE SAÍDA (JSON):
{
  "titles": [{"text":"", "recommended": false}],
  "script": {
    "target_minutes": "",
    "teleprompter_text": "",
    "sections": [{"name":"", "content":""}]
  },
  "description": "",
  "tags": []
}
`;
}

// Endpoint principal
app.post("/api/generate", async (req, res) => {
  try {
    const { tema, publico, keyword, mode, offer_name, offer_link, offer_cta } = req.body || {};
    if (!tema || !publico || !keyword) {
      return res.status(400).json({ error: "Campos obrigatórios: tema, publico, keyword" });
    }

    const response = await client.responses.create({
      model: "gpt-5.2",
      instructions: buildSystemPrompt(),
      input: buildUserPrompt({ tema, publico, keyword, mode, offer_name, offer_link, offer_cta }),
    });

    const text = response.output_text;

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      const start = text.indexOf("{");
      const end = text.lastIndexOf("}");
      if (start >= 0 && end > start) data = JSON.parse(text.slice(start, end + 1));
      else return res.status(500).json({ error: "Resposta não veio em JSON válido.", raw: text });
    }

    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: "Falha ao gerar conteúdo.", detail: err?.message || String(err) });
  }
});

// Endpoint: sugestões de keyword com IA
app.post("/api/keyword_suggest", async (req, res) => {
  try {
    const { keyword, tema, publico, channel_level, video_type, competition_level } = req.body || {};
    if (!keyword) return res.status(400).json({ error: "Campo obrigatório: keyword" });

    const prompt = `
Você é especialista em SEO para YouTube e pesquisa de palavras-chave.
Gere 10 sugestões LONG-TAIL (mais fáceis de ranquear) mantendo a intenção original.

DADOS:
- keyword base: "${keyword}"
- tema: "${tema || ""}"
- público: "${publico || ""}"
- nível do canal: "${channel_level || "small"}"
- tipo de vídeo: "${video_type || "tutorial"}"
- concorrência: "${competition_level || "medium"}"

REGRAS:
- PT-BR.
- Evite duplicadas.
- Evite promessas exageradas.
- Responda SOMENTE em JSON:
{ "suggestions": ["...", "..."] }
`;

    const response = await client.responses.create({
      model: "gpt-5.2",
      instructions: buildSystemPrompt(),
      input: prompt,
    });

    const text = response.output_text;

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      const start = text.indexOf("{");
      const end = text.lastIndexOf("}");
      if (start >= 0 && end > start) data = JSON.parse(text.slice(start, end + 1));
      else return res.status(500).json({ error: "Resposta não veio em JSON válido.", raw: text });
    }

    if (!data?.suggestions || !Array.isArray(data.suggestions)) {
      return res.status(500).json({ error: "Formato inválido retornado pela IA.", raw: data });
    }

    return res.json({ suggestions: data.suggestions.slice(0, 10) });
  } catch (err) {
    return res.status(500).json({ error: "Falha ao gerar sugestões.", detail: err?.message || String(err) });
  }
});

// Endpoint: gerar só títulos
app.post("/api/titles_only", async (req, res) => {
  try {
    const { tema, publico, keyword, channel_level, video_type, competition_level } = req.body || {};
    if (!tema || !publico || !keyword) {
      return res.status(400).json({ error: "Campos obrigatórios: tema, publico, keyword" });
    }

    const prompt = `
Você é especialista em SEO para YouTube e criação de títulos.

DADOS:
- Tema: "${tema}"
- Público: "${publico}"
- Palavra-chave: "${keyword}"
- Nível do canal: "${channel_level || "small"}"
- Tipo de vídeo: "${video_type || "tutorial"}"
- Concorrência: "${competition_level || "medium"}"

REGRAS:
- Gere 10 títulos PT-BR.
- Priorize keyword no começo quando possível.
- Sem clickbait exagerado.
- Marque 1 como recommended.
- Responda SOMENTE em JSON:
{ "titles": [ { "text": "...", "recommended": false } ] }
`;

    const response = await client.responses.create({
      model: "gpt-5.2",
      instructions: buildSystemPrompt(),
      input: prompt,
    });

    const text = response.output_text;

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      const start = text.indexOf("{");
      const end = text.lastIndexOf("}");
      if (start >= 0 && end > start) data = JSON.parse(text.slice(start, end + 1));
      else return res.status(500).json({ error: "Resposta não veio em JSON válido.", raw: text });
    }

    if (!data?.titles || !Array.isArray(data.titles)) {
      return res.status(500).json({ error: "Formato inválido retornado pela IA.", raw: data });
    }

    return res.json({ titles: data.titles.slice(0, 10) });
  } catch (err) {
    return res.status(500).json({ error: "Falha ao gerar títulos.", detail: err?.message || String(err) });
  }
});

// Health check (pra testar no navegador)
app.get("/api/health", (req, res) => res.json({ ok: true }));

const port = process.env.PORT || 3333;
app.listen(port, () => console.log("Server rodando na porta", port));
