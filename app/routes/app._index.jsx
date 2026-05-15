import { json } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  InlineStack,
  Button,
  Badge,
  Box,
  Icon,
  Divider,
  Banner,
  List,
} from "@shopify/polaris";
import { WandIcon, ProductIcon, SettingsIcon, ChartVerticalFilledIcon } from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

  // Fetch product stats
  const response = await admin.graphql(`
    query {
      products(first: 250) {
        edges {
          node {
            id
            descriptionHtml
            title
          }
        }
        pageInfo {
          hasNextPage
        }
      }
    }
  `);

  const data = await response.json();
  const products = data.data?.products?.edges || [];
  const totalProducts = products.length;
  const productsWithDescriptions = products.filter(
    (p) => p.node.descriptionHtml && p.node.descriptionHtml.trim().length > 20
  ).length;
  const productsWithoutDescriptions = totalProducts - productsWithDescriptions;

  return json({
    stats: {
      total: totalProducts,
      withDescriptions: productsWithDescriptions,
      withoutDescriptions: productsWithoutDescriptions,
      coveragePercent:
        totalProducts > 0
          ? Math.round((productsWithDescriptions / totalProducts) * 100)
          : 0,
    },
  });
};

export default function Index() {
  const { stats } = useLoaderData();

  return (
    <Page>
      <BlockStack gap="600">
        {/* Hero Banner */}
        <Card>
          <Box padding="600">
            <BlockStack gap="400">
              <InlineStack gap="300" align="start" blockAlign="center">
                <div style={{
                  background: "linear-gradient(135deg, #5c6ac4, #8DB8F9)",
                  borderRadius: "12px",
                  padding: "12px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}>
                  <Icon source={WandIcon} tone="base" />
                </div>
                <BlockStack gap="100">
                  <Text variant="headingXl" as="h1">AI Product Descriptions</Text>
                  <Text variant="bodyMd" tone="subdued">
                    Powered by Claude — Write compelling descriptions in seconds
                  </Text>
                </BlockStack>
              </InlineStack>

              {stats.withoutDescriptions > 0 && (
                <Banner
                  title={`${stats.withoutDescriptions} products need descriptions`}
                  tone="warning"
                  action={{
                    content: "Generate Now",
                    url: "/app/bulk",
                  }}
                >
                  <p>Use the Bulk Generator to add AI descriptions to all products at once.</p>
                </Banner>
              )}
            </BlockStack>
          </Box>
        </Card>

        {/* Stats Row */}
        <Layout>
          <Layout.Section variant="oneThird">
            <StatCard
              label="Total Products"
              value={stats.total}
              color="#5c6ac4"
              sublabel="in your store"
            />
          </Layout.Section>
          <Layout.Section variant="oneThird">
            <StatCard
              label="With Descriptions"
              value={stats.withDescriptions}
              color="#008060"
              sublabel={`${stats.coveragePercent}% coverage`}
            />
          </Layout.Section>
          <Layout.Section variant="oneThird">
            <StatCard
              label="Need Descriptions"
              value={stats.withoutDescriptions}
              color={stats.withoutDescriptions > 0 ? "#d82c0d" : "#008060"}
              sublabel="missing content"
            />
          </Layout.Section>
        </Layout>

        {/* Quick Actions */}
        <Layout>
          <Layout.Section variant="oneHalf">
            <Card>
              <Box padding="500">
                <BlockStack gap="400">
                  <InlineStack gap="300" blockAlign="center">
                    <Icon source={ProductIcon} tone="base" />
                    <Text variant="headingMd" as="h2">Product Editor</Text>
                  </InlineStack>
                  <Text variant="bodyMd" tone="subdued">
                    Browse your product catalog, generate individual descriptions,
                    and publish directly to Shopify with one click.
                  </Text>
                  <InlineStack gap="200">
                    <Button url="/app/products" variant="primary">
                      Browse Products
                    </Button>
                  </InlineStack>
                </BlockStack>
              </Box>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneHalf">
            <Card>
              <Box padding="500">
                <BlockStack gap="400">
                  <InlineStack gap="300" blockAlign="center">
                    <Icon source={WandIcon} tone="base" />
                    <Text variant="headingMd" as="h2">Bulk Generator</Text>
                  </InlineStack>
                  <Text variant="bodyMd" tone="subdued">
                    Generate AI descriptions for multiple products simultaneously.
                    Perfect for new store launches or catalog refreshes.
                  </Text>
                  <InlineStack gap="200">
                    <Button url="/app/bulk" variant="primary">
                      Bulk Generate
                    </Button>
                  </InlineStack>
                </BlockStack>
              </Box>
            </Card>
          </Layout.Section>
        </Layout>

        {/* Feature List */}
        <Card>
          <Box padding="500">
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">What Claude Can Do</Text>
              <Divider />
              <Layout>
                <Layout.Section variant="oneHalf">
                  <List type="bullet">
                    <List.Item>Generate SEO-optimized product descriptions</List.Item>
                    <List.Item>Match your brand tone (professional, friendly, luxury)</List.Item>
                    <List.Item>Create short, medium, or long-form content</List.Item>
                  </List>
                </Layout.Section>
                <Layout.Section variant="oneHalf">
                  <List type="bullet">
                    <List.Item>Improve existing descriptions</List.Item>
                    <List.Item>Support multiple languages</List.Item>
                    <List.Item>Publish directly to Shopify products</List.Item>
                  </List>
                </Layout.Section>
              </Layout>
            </BlockStack>
          </Box>
        </Card>
      </BlockStack>
    </Page>
  );
}

function StatCard({ label, value, color, sublabel }) {
  return (
    <Card>
      <Box padding="500">
        <BlockStack gap="200">
          <Text variant="bodySm" tone="subdued">{label}</Text>
          <Text
            variant="heading2xl"
            as="p"
            fontWeight="bold"
          >
            <span style={{ color }}>{value}</span>
          </Text>
          <Text variant="bodySm" tone="subdued">{sublabel}</Text>
        </BlockStack>
      </Box>
    </Card>
  );
}
