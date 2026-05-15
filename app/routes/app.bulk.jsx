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
  Divider,
  Banner,
  ProgressBar,
  DataTable,
  Toast,
  Frame,
  Spinner,
} from "@shopify/polaris";
import { ImageIcon } from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import { generateProductDescription } from "../ai.server";
import { useState, useCallback, useEffect } from "react";

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

  const response = await admin.graphql(`
    query {
      products(first: 50, sortKey: TITLE) {
        edges {
          node {
            id
            title
            vendor
            descriptionHtml
            featuredImage {
              url
              altText
            }
            variants(first: 1) {
              edges {
                node {
                  price
                }
              }
            }
          }
        }
      }
    }
  `);

  const data = await response.json();
  const products = (data.data?.products?.edges || []).map((edge) => ({
    id: edge.node.id,
    title: edge.node.title,
    vendor: edge.node.vendor || "",
    hasDescription: !!(edge.node.descriptionHtml?.trim().length > 20),
    imageUrl: edge.node.featuredImage?.url || null,
    price: edge.node.variants?.edges?.[0]?.node?.price || "0.00",
  }));

  return json({ products });
};

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "bulk-generate") {
    const productIdsRaw = formData.get("productIds") || "";
    const productIds = productIdsRaw.split(",").filter(Boolean);
    const tone = formData.get("tone") || "professional";
    const length = formData.get("length") || "medium";
    const overwrite = formData.get("overwrite") === "true";

    const results = [];

    for (const productId of productIds) {
      try {
        // Fetch product
        const productResponse = await admin.graphql(`
          query getProduct($id: ID!) {
            product(id: $id) {
              id
              title
              vendor
              productType
              tags
              descriptionHtml
              options { name values }
              variants(first: 1) {
                edges {
                  node { price weight weightUnit }
                }
              }
            }
          }
        `, { variables: { id: productId } });

        const productData = await productResponse.json();
        const product = productData.data?.product;

        if (!product) {
          results.push({ id: productId, success: false, error: "Not found" });
          continue;
        }

        // Skip if has description and overwrite is false
        if (product.descriptionHtml?.trim().length > 20 && !overwrite) {
          results.push({ id: productId, title: product.title, success: true, skipped: true });
          continue;
        }

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

        const description = await generateProductDescription(shopifyProduct, { tone, length });

        // Update product
        await admin.graphql(`
          mutation updateProduct($input: ProductInput!) {
            productUpdate(input: $input) {
              product { id }
              userErrors { field message }
            }
          }
        `, {
          variables: {
            input: { id: productId, descriptionHtml: description },
          },
        });

        results.push({ id: productId, title: product.title, success: true, skipped: false });
      } catch (error) {
        results.push({ id: productId, success: false, error: error.message });
      }
    }

    const successful = results.filter((r) => r.success && !r.skipped).length;
    const skipped = results.filter((r) => r.skipped).length;
    const failed = results.filter((r) => !r.success).length;

    return json({ success: true, results, successful, skipped, failed });
  }

  return json({ success: false, error: "Unknown intent" });
};

export default function BulkGenerator() {
  const { products } = useLoaderData();
  const actionData = useActionData();
  const submit = useSubmit();
  const navigation = useNavigation();

  const [selectedProducts, setSelectedProducts] = useState([]);
  const [tone, setTone] = useState("professional");
  const [length, setLength] = useState("medium");
  const [overwriteExisting, setOverwriteExisting] = useState(false);
  const [selectAll, setSelectAll] = useState(false);
  const [filterMissingOnly, setFilterMissingOnly] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const isRunning = navigation.state === "submitting";

  const displayProducts = filterMissingOnly
    ? products.filter((p) => !p.hasDescription)
    : products;

  const handleSelectAll = useCallback(
    (checked) => {
      setSelectAll(checked);
      setSelectedProducts(checked ? displayProducts.map((p) => p.id) : []);
    },
    [displayProducts]
  );

  const handleSelectMissingOnly = useCallback(() => {
    const missing = products.filter((p) => !p.hasDescription).map((p) => p.id);
    setSelectedProducts(missing);
    setSelectAll(false);
  }, [products]);

  const toggleProduct = useCallback((productId) => {
    setSelectedProducts((prev) =>
      prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId]
    );
  }, []);

  const handleBulkGenerate = useCallback(() => {
    submit(
      {
        intent: "bulk-generate",
        productIds: selectedProducts.join(","),
        tone,
        length,
        overwrite: String(overwriteExisting),
      },
      { method: "post" }
    );
  }, [submit, selectedProducts, tone, length, overwriteExisting]);

  useEffect(() => {
    if (actionData?.success && actionData.results) {
      setToastMessage(
        `Done! ${actionData.successful} updated, ${actionData.skipped} skipped, ${actionData.failed} failed`
      );
      setShowToast(true);
    }
  }, [actionData]);

  const missingCount = products.filter((p) => !p.hasDescription).length;

  const rows = displayProducts.map((product) => {
    const isSelected = selectedProducts.includes(product.id);
    const resultEntry = actionData?.results?.find((r) => r.id === product.id);

    return [
      <Checkbox
        key={`check-${product.id}`}
        label=""
        labelHidden
        checked={isSelected}
        onChange={() => toggleProduct(product.id)}
      />,
      <InlineStack key={`img-${product.id}`} gap="300" blockAlign="center">
        <Thumbnail
          source={product.imageUrl || ImageIcon}
          size="small"
          alt={product.title}
        />
        <Text variant="bodyMd" fontWeight="semibold">{product.title}</Text>
      </InlineStack>,
      product.vendor || "—",
      `$${product.price}`,
      <Badge
        key={`badge-${product.id}`}
        tone={product.hasDescription ? "success" : "critical"}
      >
        {product.hasDescription ? "Has description" : "Missing"}
      </Badge>,
      resultEntry ? (
        <Badge
          key={`result-${product.id}`}
          tone={resultEntry.success ? (resultEntry.skipped ? "info" : "success") : "critical"}
        >
          {resultEntry.skipped ? "Skipped" : resultEntry.success ? "Updated ✓" : "Failed"}
        </Badge>
      ) : "—",
    ];
  });

  return (
    <Frame>
      <Page
        title="Bulk Description Generator"
        subtitle="Generate AI descriptions for multiple products at once"
        backAction={{ content: "Dashboard", url: "/app" }}
      >
        <Layout>
          {/* Settings Panel */}
          <Layout.Section variant="oneThird">
            <BlockStack gap="400">
              <Card>
                <Box padding="400">
                  <BlockStack gap="400">
                    <Text variant="headingMd" as="h2">Generation Settings</Text>

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
                      label="Description Length"
                      options={[
                        { label: "Short (50-80 words)", value: "short" },
                        { label: "Medium (100-150 words)", value: "medium" },
                        { label: "Long (200-300 words)", value: "long" },
                      ]}
                      value={length}
                      onChange={setLength}
                    />

                    <Divider />

                    <Checkbox
                      label="Overwrite existing descriptions"
                      helpText="If unchecked, products with existing descriptions will be skipped"
                      checked={overwriteExisting}
                      onChange={setOverwriteExisting}
                    />
                  </BlockStack>
                </Box>
              </Card>

              <Card>
                <Box padding="400">
                  <BlockStack gap="300">
                    <Text variant="headingMd" as="h2">Selection</Text>

                    <BlockStack gap="200">
                      <Button onClick={() => handleSelectAll(!selectAll)} fullWidth>
                        {selectAll ? "Deselect All" : "Select All"}
                      </Button>
                      {missingCount > 0 && (
                        <Button onClick={handleSelectMissingOnly} fullWidth>
                          Select Missing ({missingCount})
                        </Button>
                      )}
                    </BlockStack>

                    <Divider />

                    <Text variant="bodyMd" tone="subdued">
                      {selectedProducts.length} product{selectedProducts.length !== 1 ? "s" : ""} selected
                    </Text>

                    <Button
                      variant="primary"
                      onClick={handleBulkGenerate}
                      disabled={selectedProducts.length === 0 || isRunning}
                      loading={isRunning}
                      size="large"
                      fullWidth
                    >
                      {isRunning
                        ? "Generating..."
                        : `✨ Generate ${selectedProducts.length} Descriptions`}
                    </Button>
                  </BlockStack>
                </Box>
              </Card>

              {/* Summary Banner */}
              {actionData?.success && (
                <Banner
                  title="Generation Complete"
                  tone="success"
                >
                  <BlockStack gap="100">
                    <Text variant="bodyMd">✅ {actionData.successful} descriptions updated</Text>
                    {actionData.skipped > 0 && (
                      <Text variant="bodyMd">⏭ {actionData.skipped} skipped (had descriptions)</Text>
                    )}
                    {actionData.failed > 0 && (
                      <Text variant="bodyMd" tone="critical">❌ {actionData.failed} failed</Text>
                    )}
                  </BlockStack>
                </Banner>
              )}
            </BlockStack>
          </Layout.Section>

          {/* Product Table */}
          <Layout.Section>
            <Card padding="0">
              <Box padding="400">
                <InlineStack align="space-between" blockAlign="center">
                  <Text variant="headingMd" as="h2">Products ({displayProducts.length})</Text>
                  <Checkbox
                    label="Show missing only"
                    checked={filterMissingOnly}
                    onChange={setFilterMissingOnly}
                  />
                </InlineStack>
              </Box>
              <Divider />
              <DataTable
                columnContentTypes={["text", "text", "text", "text", "text", "text"]}
                headings={["", "Product", "Vendor", "Price", "Description", "Status"]}
                rows={rows}
              />
            </Card>
          </Layout.Section>
        </Layout>
      </Page>

      {showToast && (
        <Toast
          content={toastMessage}
          onDismiss={() => setShowToast(false)}
          duration={6000}
        />
      )}
    </Frame>
  );
}
