import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRouteError,
} from "@remix-run/react";
import { json } from "@remix-run/node";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import { boundary } from "@shopify/shopify-app-remix/server";
import { addDocumentResponseHeaders } from "./shopify.server";

export const links = () => [
  { rel: "stylesheet", href: polarisStyles },
];

export const headers = ({ loaderHeaders }) => {
  return boundary.headers({ loaderHeaders });
};

export const loader = async ({ request }) => {
  await addDocumentResponseHeaders(request, new Headers());
  return json({ apiKey: process.env.SHOPIFY_API_KEY || "" });
};

export default function App() {
  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <Outlet />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  return boundary.error(error);
}
