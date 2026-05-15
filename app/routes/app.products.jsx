import { json } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  ResourceList,
  ResourceItem,
  Text,
  InlineStack,
  Badge,
  Thumbnail,
  BlockStack,
  Button,
  Box,
  Filters,
  TextField,
  ChoiceList,
  EmptyState,
} from "@shopify/polaris";
import { ImageIcon } from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import { useState, useCallback } from "react";

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor") || null;
  const cursorArgs = cursor ? `, after: "${cursor}"` : "";

  const response = await admin.graphql(`
    query {
      products(first: 20${cursorArgs}, sortKey: TITLE) {
        edges {
          node {
            id
            title
            handle
            status
            vendor
            productType
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
          cursor
        }
        pageInfo {
          hasNextPage
          hasPreviousPage
          startCursor
          endCursor
        }
      }
    }
  `);

  const data = await response.json();
  const edges = data.data?.products?.edges || [];
  const pageInfo = data.data?.products?.pageInfo || {};

  const products = edges.map((edge) => ({
    id: edge.node.id,
    cursor: edge.cursor,
    title: edge.node.title,
    handle: edge.node.handle,
    status: edge.node.status,
    vendor: edge.node.vendor,
    productType: edge.node.productType,
    hasDescription: !!(edge.node.descriptionHtml?.trim().length > 20),
    imageUrl: edge.node.featuredImage?.url || null,
    imageAlt: edge.node.featuredImage?.altText || "",
    price: edge.node.variants?.edges?.[0]?.node?.price || "0.00",
  }));

  return json({ products, pageInfo });
};

export default function ProductsPage() {
  const { products, pageInfo } = useLoaderData();
  const navigate = useNavigate();
  const [queryValue, setQueryValue] = useState("");
  const [filterStatus, setFilterStatus] = useState([]);

  const handleQueryChange = useCallback((value) => setQueryValue(value), []);
  const handleQueryClear = useCallback(() => setQueryValue(""), []);
  const handleFilterClear = useCallback(() => setFilterStatus([]), []);

  const filteredProducts = products.filter((p) => {
    const matchesQuery =
      !queryValue ||
      p.title.toLowerCase().includes(queryValue.toLowerCase()) ||
      p.vendor?.toLowerCase().includes(queryValue.toLowerCase());

    const matchesFilter =
      filterStatus.length === 0 ||
      (filterStatus.includes("missing") && !p.hasDescription) ||
      (filterStatus.includes("has_description") && p.hasDescription);

    return matchesQuery && matchesFilter;
  });

  const filters = [
    {
      key: "status",
      label: "Description Status",
      filter: (
        <ChoiceList
          title="Description Status"
          titleHidden
          choices={[
            { label: "Has description", value: "has_description" },
            { label: "Missing description", value: "missing" },
          ]}
          selected={filterStatus}
          onChange={setFilterStatus}
          allowMultiple
        />
      ),
      shortcut: true,
    },
  ];

  const appliedFilters = filterStatus.length > 0 ? [
    {
      key: "status",
      label: `Description: ${filterStatus.join(", ")}`,
      onRemove: handleFilterClear,
    },
  ] : [];

  return (
    <Page
      title="Products"
      subtitle="Select a product to generate or edit its AI description"
      primaryAction={{
        content: "Bulk Generate",
        url: "/app/bulk",
      }}
    >
      <Layout>
        <Layout.Section>
          <Card padding="0">
            <ResourceList
              resourceName={{ singular: "product", plural: "products" }}
              filterControl={
                <Filters
                  queryValue={queryValue}
                  queryPlaceholder="Search products..."
                  filters={filters}
                  appliedFilters={appliedFilters}
                  onQueryChange={handleQueryChange}
                  onQueryClear={handleQueryClear}
                  onClearAll={() => {
                    handleQueryClear();
                    handleFilterClear();
                  }}
                />
              }
              emptyState={
                <EmptyState
                  heading="No products found"
                  image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                >
                  <p>Try adjusting your search or filter to find what you're looking for.</p>
                </EmptyState>
              }
              items={filteredProducts}
              renderItem={(product) => {
                const { id, title, vendor, hasDescription, imageUrl, imageAlt, price, status } = product;
                const productId = id.replace("gid://shopify/Product/", "");

                const media = (
                  <Thumbnail
                    source={imageUrl || ImageIcon}
                    size="small"
                    alt={imageAlt || title}
                  />
                );

                const shortcutActions = [
                  {
                    content: hasDescription ? "Edit Description" : "Generate Description",
                    url: `/app/products/${productId}`,
                  },
                ];

                return (
                  <ResourceItem
                    id={id}
                    media={media}
                    url={`/app/products/${productId}`}
                    shortcutActions={shortcutActions}
                    accessibilityLabel={`View details for ${title}`}
                  >
                    <InlineStack align="space-between" blockAlign="center">
                      <BlockStack gap="100">
                        <Text variant="bodyMd" fontWeight="bold" as="h3">
                          {title}
                        </Text>
                        <InlineStack gap="200">
                          {vendor && (
                            <Text variant="bodySm" tone="subdued">{vendor}</Text>
                          )}
                          <Text variant="bodySm" tone="subdued">${price}</Text>
                        </InlineStack>
                      </BlockStack>
                      <InlineStack gap="200" blockAlign="center">
                        <Badge tone={status === "ACTIVE" ? "success" : "subdued"}>
                          {status === "ACTIVE" ? "Active" : "Draft"}
                        </Badge>
                        <Badge tone={hasDescription ? "success" : "critical"}>
                          {hasDescription ? "Has description" : "No description"}
                        </Badge>
                      </InlineStack>
                    </InlineStack>
                  </ResourceItem>
                );
              }}
            />
          </Card>

          {/* Pagination */}
          {(pageInfo.hasPreviousPage || pageInfo.hasNextPage) && (
            <Box paddingBlockStart="400">
              <InlineStack align="center" gap="300">
                {pageInfo.hasPreviousPage && (
                  <Button
                    onClick={() => navigate("/app/products")}
                  >
                    Previous
                  </Button>
                )}
                {pageInfo.hasNextPage && (
                  <Button
                    onClick={() =>
                      navigate(`/app/products?cursor=${pageInfo.endCursor}`)
                    }
                  >
                    Next
                  </Button>
                )}
              </InlineStack>
            </Box>
          )}
        </Layout.Section>
      </Layout>
    </Page>
  );
}
