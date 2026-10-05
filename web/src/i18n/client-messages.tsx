import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import type { ReactNode } from "react";

import { LAYOUT_NAMESPACES, PAGE_NAMESPACES, type ClientPage, type Namespace } from "./client-namespaces";

async function pick(namespaces: readonly Namespace[]) {
  const messages = await getMessages();
  return Object.fromEntries(namespaces.flatMap((namespace) => (namespace in messages ? [[namespace, messages[namespace]]] : [])));
}

/** The messages the layout's client components read, and nothing more. */
export async function LayoutMessages({ children }: { children: ReactNode }) {
  return <NextIntlClientProvider messages={await pick(LAYOUT_NAMESPACES)}>{children}</NextIntlClientProvider>;
}

/** Wraps a page so its client components receive the layout's messages and the page's own. */
export async function PageMessages({ page, children }: { page: ClientPage; children: ReactNode }) {
  const messages = await pick([...LAYOUT_NAMESPACES, ...PAGE_NAMESPACES[page]]);
  return <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>;
}
