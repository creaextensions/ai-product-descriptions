/**
 * AI Description Generator using Claude API
 * Uses Anthropic's claude-sonnet-4-20250514 model
 */

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

/**
 * Generate an AI product description using Claude
 * @param {Object} product - Shopify product object
 * @param {Object} options - Generation options
 * @returns {Promise<string>} Generated description HTML
 */
export async function generateProductDescription(product, options = {}) {
  const {
    tone = "professional",
    length = "medium",
    highlights = [],
    language = "English",
  } = options;

  const lengthGuide = {
    short: "2-3 sentences (50-80 words)",
    medium: "3-5 sentences (100-150 words)",
    long: "5-8 sentences (200-300 words)",
  };

  const toneGuide = {
    professional: "professional and authoritative",
    friendly: "warm, conversational, and approachable",
    luxury: "sophisticated, premium, and aspirational",
    playful: "fun, energetic, and engaging",
    minimalist: "clean, direct, and benefit-focused",
  };

  const productInfo = buildProductContext(product);
  const highlightText =
    highlights.length > 0
      ? `\nKey features to emphasize: ${highlights.join(", ")}`
      : "";

  const prompt = `You are an expert e-commerce copywriter specializing in compelling product descriptions that convert browsers into buyers.

Write a product description for the following Shopify product:

${productInfo}
${highlightText}

Requirements:
- Tone: ${toneGuide[tone] || toneGuide.professional}
- Length: ${lengthGuide[length] || lengthGuide.medium}
- Language: ${language}
- Focus on benefits, not just features
- Use vivid, sensory language where appropriate
- Include a subtle call-to-value (why this product matters)
- Output clean HTML with <p> tags for paragraphs and <ul>/<li> for any feature lists
- Do NOT include a product title heading — just the body description
- Do NOT include any markdown, only HTML

Generate the description now:`;

  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      `Claude API error: ${response.status} - ${error.error?.message || "Unknown error"}`
    );
  }

  const data = await response.json();
  const generatedText = data.content?.[0]?.text || "";

  return generatedText.trim();
}

/**
 * Generate multiple description variants for A/B testing
 */
export async function generateDescriptionVariants(product, count = 3) {
  const tones = ["professional", "friendly", "luxury", "playful", "minimalist"];
  const selectedTones = tones.slice(0, count);

  const variants = await Promise.all(
    selectedTones.map(async (tone) => {
      const description = await generateProductDescription(product, { tone });
      return { tone, description };
    })
  );

  return variants;
}

/**
 * Build a rich context string from Shopify product data
 */
function buildProductContext(product) {
  const lines = [`Product Title: ${product.title}`];

  if (product.vendor) lines.push(`Brand/Vendor: ${product.vendor}`);
  if (product.product_type) lines.push(`Category: ${product.product_type}`);
  if (product.tags?.length > 0)
    lines.push(`Tags: ${Array.isArray(product.tags) ? product.tags.join(", ") : product.tags}`);

  if (product.variants?.length > 0) {
    const variant = product.variants[0];
    if (variant.price) lines.push(`Price: $${variant.price}`);
    if (variant.weight) lines.push(`Weight: ${variant.weight} ${variant.weight_unit || "g"}`);
  }

  // Add option names (e.g., Size, Color, Material)
  if (product.options?.length > 0) {
    const optionInfo = product.options
      .map((opt) => `${opt.name}: ${opt.values?.join(", ")}`)
      .join("; ");
    lines.push(`Available Options: ${optionInfo}`);
  }

  if (product.body_html) {
    // Strip HTML for context, keep first 300 chars
    const existingDesc = product.body_html
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 300);
    if (existingDesc) lines.push(`Existing Description (for reference): ${existingDesc}...`);
  }

  return lines.join("\n");
}

/**
 * Improve/rewrite an existing description
 */
export async function improveProductDescription(product, existingDescription, improvements = []) {
  const improvementText =
    improvements.length > 0
      ? `Specific improvements requested: ${improvements.join(", ")}`
      : "Make it more compelling, benefit-focused, and conversion-optimized";

  const prompt = `You are an expert e-commerce copywriter. Rewrite and improve this product description for "${product.title}".

Current description:
${existingDescription.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()}

${improvementText}

Output clean HTML with <p> and <ul>/<li> tags only. No markdown, no title heading.`;

  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`Claude API error: ${response.status} - ${error.error?.message || "Unknown error"}`);
  }

  const data = await response.json();
  return data.content?.[0]?.text?.trim() || "";
}
