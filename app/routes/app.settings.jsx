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
  Box,
  Select,
  TextField,
  Divider,
  Banner,
  Toast,
  Frame,
  List,
  Link,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { useState, useEffect, useCallback } from "react";

export const loader = async ({ request }) => {
  await authenticate.admin(request);

  const hasApiKey = !!(process.env.ANTHROPIC_API_KEY);
  const apiKeyMasked = process.env.ANTHROPIC_API_KEY
    ? `sk-ant-...${process.env.ANTHROPIC_API_KEY.slice(-6)}`
    : "";

  return json({ hasApiKey, apiKeyMasked });
};

export const action = async ({ request }) => {
  await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "test-api") {
    if (!process.env.ANTHROPIC_API_KEY) {
      return json({ success: false, error: "No ANTHROPIC_API_KEY set in environment" });
    }

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 50,
          messages: [{ role: "user", content: "Say 'API connection successful' in exactly 3 words." }],
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        return json({ success: false, error: err.error?.message || "API request failed" });
      }

      const data = await response.json();
      return json({ success: true, message: data.content?.[0]?.text || "Connection OK" });
    } catch (error) {
      return json({ success: false, error: error.message });
    }
  }

  return json({ success: false, error: "Unknown intent" });
};

export default function SettingsPage() {
  const { hasApiKey, apiKeyMasked } = useLoaderData();
  const actionData = useActionData();
  const submit = useSubmit();
  const navigation = useNavigation();

  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastError, setToastError] = useState(false);

  const isTesting = navigation.state === "submitting";

  useEffect(() => {
    if (actionData) {
      setToastMessage(
        actionData.success
          ? `✅ ${actionData.message}`
          : `❌ ${actionData.error}`
      );
      setToastError(!actionData.success);
      setShowToast(true);
    }
  }, [actionData]);

  const handleTestApi = useCallback(() => {
    submit({ intent: "test-api" }, { method: "post" });
  }, [submit]);

  return (
    <Frame>
      <Page
        title="Settings"
        subtitle="Configure your AI description generator"
        backAction={{ content: "Dashboard", url: "/app" }}
      >
        <Layout>
          <Layout.Section>
            <BlockStack gap="500">
              {/* API Status */}
              <Card>
                <Box padding="500">
                  <BlockStack gap="400">
                    <InlineStack align="space-between" blockAlign="center">
                      <Text variant="headingMd" as="h2">Claude API Connection</Text>
                      <Badge tone={hasApiKey ? "success" : "critical"}>
                        {hasApiKey ? "Connected" : "Not configured"}
                      </Badge>
                    </InlineStack>

                    <Divider />

                    {hasApiKey ? (
                      <BlockStack gap="300">
                        <InlineStack gap="300" blockAlign="center">
                          <Text variant="bodyMd">API Key:</Text>
                          <Text variant="bodyMd" fontWeight="semibold">{apiKeyMasked}</Text>
                        </InlineStack>
                        <Text variant="bodyMd" tone="subdued">
                          Model: claude-sonnet-4-20250514
                        </Text>
                        <Button
                          onClick={handleTestApi}
                          loading={isTesting}
                        >
                          Test Connection
                        </Button>
                      </BlockStack>
                    ) : (
                      <Banner tone="warning" title="API Key Required">
                        <p>
                          Set <code>ANTHROPIC_API_KEY</code> in your <code>.env</code> file
                          to enable AI description generation.
                        </p>
                      </Banner>
                    )}
                  </BlockStack>
                </Box>
              </Card>

              {/* Setup Guide */}
              <Card>
                <Box padding="500">
                  <BlockStack gap="400">
                    <Text variant="headingMd" as="h2">Setup Guide</Text>
                    <Divider />

                    <BlockStack gap="300">
                      <Text variant="bodyMd" fontWeight="semibold">1. Get an Anthropic API Key</Text>
                      <Text variant="bodyMd" tone="subdued">
                        Visit{" "}
                        <Link url="https://console.anthropic.com" external>
                          console.anthropic.com
                        </Link>{" "}
                        to create an account and generate an API key.
                      </Text>
                    </BlockStack>

                    <BlockStack gap="300">
                      <Text variant="bodyMd" fontWeight="semibold">2. Configure Environment</Text>
                      <Box
                        background="bg-surface-secondary"
                        padding="300"
                        borderRadius="100"
                      >
                        <Text variant="bodyMd" as="p">
                          <code>ANTHROPIC_API_KEY=sk-ant-your-key-here</code>
                        </Text>
                      </Box>
                      <Text variant="bodyMd" tone="subdued">
                        Add this to your <code>.env</code> file in the root of the app.
                      </Text>
                    </BlockStack>

                    <BlockStack gap="300">
                      <Text variant="bodyMd" fontWeight="semibold">3. Configure Shopify App</Text>
                      <Text variant="bodyMd" tone="subdued">
                        Update <code>shopify.app.toml</code> with your app's client ID
                        and tunnel URL from <code>shopify app dev</code>.
                      </Text>
                    </BlockStack>

                    <BlockStack gap="300">
                      <Text variant="bodyMd" fontWeight="semibold">4. Set Scopes</Text>
                      <Box
                        background="bg-surface-secondary"
                        padding="300"
                        borderRadius="100"
                      >
                        <Text variant="bodyMd">
                          <code>read_products, write_products</code>
                        </Text>
                      </Box>
                    </BlockStack>
                  </BlockStack>
                </Box>
              </Card>

              {/* App Info */}
              <Card>
                <Box padding="500">
                  <BlockStack gap="400">
                    <Text variant="headingMd" as="h2">About This App</Text>
                    <Divider />
                    <BlockStack gap="200">
                      <InlineStack gap="300">
                        <Text variant="bodyMd" tone="subdued">Version:</Text>
                        <Text variant="bodyMd">1.0.0</Text>
                      </InlineStack>
                      <InlineStack gap="300">
                        <Text variant="bodyMd" tone="subdued">Framework:</Text>
                        <Text variant="bodyMd">Remix + Shopify App Remix</Text>
                      </InlineStack>
                      <InlineStack gap="300">
                        <Text variant="bodyMd" tone="subdued">UI Library:</Text>
                        <Text variant="bodyMd">Shopify Polaris v13</Text>
                      </InlineStack>
                      <InlineStack gap="300">
                        <Text variant="bodyMd" tone="subdued">AI Model:</Text>
                        <Text variant="bodyMd">Claude claude-sonnet-4-20250514</Text>
                      </InlineStack>
                    </BlockStack>
                  </BlockStack>
                </Box>
              </Card>
            </BlockStack>
          </Layout.Section>
        </Layout>
      </Page>

      {showToast && (
        <Toast
          content={toastMessage}
          error={toastError}
          onDismiss={() => setShowToast(false)}
          duration={5000}
        />
      )}
    </Frame>
  );
}
