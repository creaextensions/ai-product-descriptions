import { json } from "@remix-run/node";
import { useLoaderData, useSubmit, useNavigation, useActionData } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  InlineStack,
  Button,
  Badge,
  Thumbnail,
  Box,
  Select,
  Checkbox,
  TextField,
  Divider,
  Banner,
  Spinner,
  Toast,
  Frame,
  Tag,
} from "@shopify/polaris";
import { ImageIcon } from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import { generateProductDescription, improveProductDescription } from "../ai.server";
import { useState, useCallback, useEffect } from "react";

export const loader = async ({ request, params }) => {
  const { admin } = await authenticate.admin(request);
  const productId = `gid://shopify/Product/${params.id}`;

  const response = await admin.graphql(`
    query getProduct($id: ID!) {
      product(id: $id) {
        id
        title
        handle
        descriptionHtml
        vendor
        productType
        status
        tags
        featuredImage {
          url
          altText
        }
        options {
          name
          values
        }
        variants(first: 5) {
          edges {
            node {
              id
              title
              price
              weight
              weightUnit
            }
          }
        }
      }
    }
  `, { variables: { id: productId } });

  const data = await response.json();
  const product = data.data?.product;

  if (!product) {
    throw new Response("Product not found", { status: 404 });
  }

  return json({ product });
};

export const action = async ({ request, params }) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");
  const productId = `gid://shopify/Product/${params.id}`;

  if (intent === "generate") {
    const tone = formData.get("tone") || "professional";
    const length = formData.get("length") || "medium";
    const language = formData.get("language") || "English";
    const highlightsRaw = formData.get("highlights") || "";
    const highlights = highlightsRaw
      .split(",")
      .map((h) => h.trim())
      .filter(Boolean);

    // Fetch product data for generation
    const productResponse = await admin.graphql(`
      query getProduct($id: ID!) {
        product(id: $id) {
          id
          title
          vendor
          productType
          tags
          descriptionHtml
          options {
            name
            values
          }
          variants(first: 1) {
            edges {
              node {
                price
                weight
                weightUnit
              }
            }
          }
        }
      }
    `, { variables: { id: productId } });

    const productData = await productResponse.json();
    const product = productData.data?.product;

    const shopifyProduct = {
      title: product.title,
      vendor: product.vendor,
      product_type: product.productType,
      tags: product.tags,
      body_html: product.descriptionHtml,
      options: product.options,
      variants: product.variants?.edges?.map((e) => ({
        price: e.node.price,
        weight: e.node.weight,
        weight_unit: e.node.weightUnit,
      })),
    };

    try {
      const description = await generateProductDescription(shopifyProduct, {
        tone,
        length,
        language,
        highlights,
      });
      return json({ success: true, description, intent: "generate" });
    } catch (error) {
      return json({
        success: false,
        error: error.message,
        intent: "generate",
      });
    }
  }

  if (intent === "improve") {
    const existingDescription = formData.get("existingDescription") || "";

    const productResponse = await admin.graphql(`
      query getProduct($id: ID!) {
        product(id: $id) {
          title
        }
      }
    `, { variables: { id: productId } });

    const productData = await productResponse.json();
    const product = productData.data?.product;

    try {
      const description = await improveProductDescription(
        { title: product.title },
        existingDescription
      );
      return json({ success: true, description, intent: "improve" });
    } catch (error) {
      return json({ success: false, error: error.message, intent: "improve" });
    }
  }

  if (intent === "publish") {
    const description = formData.get("description");

    try {
      await admin.graphql(`
        mutation updateProduct($input: ProductInput!) {
          productUpdate(input: $input) {
            product {
              id
              descriptionHtml
            }
            userErrors {
              field
              message
            }
          }
        }
      `, {
        variables: {
          input: {
            id: productId,
            descriptionHtml: description,
          },
        },
      });

      return json({ success: true, intent: "publish" });
    } catch (error) {
      return json({ success: false, error: error.message, intent: "publish" });
    }
  }

  return json({ success: false, error: "Unknown intent" });
};

export default function ProductEditor() {
  const { product } = useLoaderData();
  const actionData = useActionData();
  const submit = useSubmit();
  const navigation = useNavigation();

  const [tone, setTone] = useState("professional");
  const [length, setLength] = useState("medium");
  const [language, setLanguage] = useState("English");
  const [highlights, setHighlights] = useState("");
  const [generatedDescription, setGeneratedDescription] = useState(
    product.descriptionHtml || ""
  );
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastError, setToastError] = useState(false);

  const isGenerating = navigation.state === "submitting" &&
    (navigation.formData?.get("intent") === "generate" || navigation.formData?.get("intent") === "improve");
  const isPublishing = navigation.state === "submitting" &&
    navigation.formData?.get("intent") === "publish";

  useEffect(() => {
    if (actionData) {
      if (actionData.success && actionData.description) {
        setGeneratedDescription(actionData.description);
      }
      if (actionData.intent === "publish") {
        setToastMessage(actionData.success ? "Description published!" : "Failed to publish");
        setToastError(!actionData.success);
        setShowToast(true);
      }
      if (!actionData.success && actionData.error) {
        setToastMessage(`Error: ${actionData.error}`);
        setToastError(true);
        setShowToast(true);
      }
    }
  }, [actionData]);

  const handleGenerate = useCallback(() => {
    submit(
      { intent: "generate", tone, length, language, highlights },
      { method: "post" }
    );
  }, [submit, tone, length, language, highlights]);

  const handleImprove = useCallback(() => {
    submit(
      { intent: "improve", existingDescription: generatedDescription },
      { method: "post" }
    );
  }, [submit, generatedDescription]);

  const handlePublish = useCallback(() => {
    submit(
      { intent: "publish", description: generatedDescription },
      { method: "post" }
    );
  }, [submit, generatedDescription]);

  const productNumericId = product.id.replace("gid://shopify/Product/", "");

  return (
    <Frame>
      <Page
        title={product.title}
        subtitle={product.vendor || product.productType || ""}
        backAction={{ content: "Products", url: "/app/products" }}
        secondaryActions={[
          {
            content: "View in Shopify",
            url: `https://admin.shopify.com/products/${productNumericId}`,
            external: true,
          },
        ]}
      >
        <Layout>
          {/* Left: Controls */}
          <Layout.Section variant="oneThird">
            <BlockStack gap="400">
              {/* Product Card */}
              <Card>
                <Box padding="400">
                  <BlockStack gap="300">
                    <InlineStack gap="300" blockAlign="center">
                      <Thumbnail
                        source={product.featuredImage?.url || ImageIcon}
                        size="medium"
                        alt={product.featuredImage?.altText || product.title}
                      />
                      <BlockStack gap="100">
                        <Text variant="headingSm" as="h3">{product.title}</Text>
                        <InlineStack gap="200">
                          <Badge tone={product.status === "ACTIVE" ? "success" : "subdued"}>
                            {product.status}
                          </Badge>
                        </InlineStack>
                        {product.variants?.edges?.[0]?.node?.price && (
                          <Text variant="bodyMd" fontWeight="semibold">
                            ${product.variants.edges[0].node.price}
                          </Text>
                        )}
                      </BlockStack>
                    </InlineStack>

                    {product.tags?.length > 0 && (
                      <>
                        <Divider />
                        <BlockStack gap="200">
                          <Text variant="bodySm" tone="subdued">Tags</Text>
                          <InlineStack gap="100" wrap>
                            {(Array.isArray(product.tags)
                              ? product.tags
                              : product.tags.split(",")
                            ).slice(0, 6).map((tag) => (
                              <Tag key={tag}>{tag.trim()}</Tag>
                            ))}
                          </InlineStack>
                        </BlockStack>
                      </>
                    )}
                  </BlockStack>
                </Box>
              </Card>

              {/* Generation Options */}
              <Card>
                <Box padding="400">
                  <BlockStack gap="400">
                    <Text variant="headingMd" as="h2">Generation Options</Text>

                    <Select
                      label="Tone"
                      options={[
                        { label: "Professional", value: "professional" },
                        { label: "Friendly & Warm", value: "friendly" },
                        { label: "Luxury & Premium", value: "luxury" },
                        { label: "Playful & Fun", value: "playful" },
                        { label: "Clean Minimalist", value: "minimalist" },
                      ]}
                      value={tone}
                      onChange={setTone}
                    />

                    <Select
                      label="Length"
                      options={[
                        { label: "Short (50-80 words)", value: "short" },
                        { label: "Medium (100-150 words)", value: "medium" },
                        { label: "Long (200-300 words)", value: "long" },
                      ]}
                      value={length}
                      onChange={setLength}
                    />

                    <Select
                      label="Language"
                      options={[
                        { label: "English", value: "English" },
                        { label: "Spanish", value: "Spanish" },
                        { label: "French", value: "French" },
                        { label: "German", value: "German" },
                        { label: "Italian", value: "Italian" },
                        { label: "Portuguese", value: "Portuguese" },
                        { label: "Dutch", value: "Dutch" },
                        { label: "Japanese", value: "Japanese" },
                        { label: "Chinese (Simplified)", value: "Chinese (Simplified)" },
                      ]}
                      value={language}
                      onChange={setLanguage}
                    />

                    <TextField
                      label="Key Features to Highlight"
                      placeholder="e.g., waterproof, eco-friendly, handmade"
                      helpText="Comma-separated list of features to emphasize"
                      value={highlights}
                      onChange={setHighlights}
                      multiline={2}
                    />

                    <Button
                      variant="primary"
                      onClick={handleGenerate}
                      loading={isGenerating}
                      fullWidth
                      size="large"
                    >
                      {isGenerating ? "Generating..." : "✨ Generate Description"}
                    </Button>

                    {generatedDescription && (
                      <Button
                        onClick={handleImprove}
                        loading={isGenerating}
                        fullWidth
                      >
                        🔄 Improve Current Description
                      </Button>
                    )}
                  </BlockStack>
                </Box>
              </Card>
            </BlockStack>
          </Layout.Section>

          {/* Right: Editor & Preview */}
          <Layout.Section>
            <BlockStack gap="400">
              {/* Generated Description Editor */}
              <Card>
                <Box padding="400">
                  <BlockStack gap="400">
                    <InlineStack align="space-between" blockAlign="center">
                      <Text variant="headingMd" as="h2">Product Description</Text>
                      {generatedDescription && (
                        <Badge tone="success">Ready to publish</Badge>
                      )}
                    </InlineStack>

                    {isGenerating ? (
                      <Box padding="800">
                        <BlockStack gap="400" align="center">
                          <Spinner size="large" />
                          <Text variant="bodyMd" tone="subdued" alignment="center">
                            Claude is crafting your description...
                          </Text>
                        </BlockStack>
                      </Box>
                    ) : (
                      <TextField
                        label="HTML Description"
                        labelHidden
                        value={generatedDescription}
                        onChange={setGeneratedDescription}
                        multiline={12}
                        placeholder="Click 'Generate Description' to create an AI-powered description, or write your own HTML here..."
                        monospaced
                      />
                    )}
                  </BlockStack>
                </Box>
              </Card>

              {/* Live Preview */}
              {generatedDescription && !isGenerating && (
                <Card>
                  <Box padding="400">
                    <BlockStack gap="300">
                      <Text variant="headingMd" as="h2">Preview</Text>
                      <Divider />
                      <Box
                        padding="400"
                        background="bg-surface-secondary"
                        borderRadius="200"
                      >
                        <div
                          style={{
                            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                            lineHeight: "1.7",
                            color: "#1a1a1a",
                          }}
                          dangerouslySetInnerHTML={{
                            __html: generatedDescription,
                          }}
                        />
                      </Box>
                    </BlockStack>
                  </Box>
                </Card>
              )}

              {/* Publish Actions */}
              {generatedDescription && (
                <Card>
                  <Box padding="400">
                    <InlineStack align="end" gap="300">
                      <Button
                        onClick={() => setGeneratedDescription(product.descriptionHtml || "")}
                        tone="critical"
                        variant="plain"
                      >
                        Reset to Original
                      </Button>
                      <Button
                        variant="primary"
                        onClick={handlePublish}
                        loading={isPublishing}
                        size="large"
                      >
                        {isPublishing ? "Publishing..." : "Publish to Shopify"}
                      </Button>
                    </InlineStack>
                  </Box>
                </Card>
              )}
            </BlockStack>
          </Layout.Section>
        </Layout>
      </Page>

      {showToast && (
        <Toast
          content={toastMessage}
          error={toastError}
          onDismiss={() => setShowToast(false)}
        />
      )}
    </Frame>
  );
}
