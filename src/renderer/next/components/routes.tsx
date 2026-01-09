import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { Routes as InternalRoutes, Route } from "react-router";

import AppLoader from "@/renderer/apps/Loader";
import Bookmarks from "@/renderer/pages/bookmark";
import Bookmark from "@/renderer/pages/bookmark/Bookmark";
import Chat from "@/renderer/pages/chat";
import Conversation from "@/renderer/pages/conversation";
import Knowledge from "@/renderer/pages/knowledge";
import KnowledgeCollectionForm from "@/renderer/pages/knowledge/CollectionForm";
import KnowledgeFiles from "@/renderer/pages/knowledge-files";
import Prompts from "@/renderer/pages/prompt";
import PromptForm from "@/renderer/pages/prompt/Form";
import Providers from "@/renderer/pages/providers";
import ProvidersNext from "@/renderer/pages/providers-next";
import Settings from "@/renderer/pages/settings";
import Tools from "@/renderer/pages/tool";
import Usage from "@/renderer/pages/usage";
import Account from "@/renderer/pages/user/Account";
import Login from "@/renderer/pages/user/Login";
import Register from "@/renderer/pages/user/Register";

const RouteSuspense = (props: React.PropsWithChildren) => {
  return <Suspense fallback={<div>Loading...</div>}>{props.children}</Suspense>;
};

const RouteErrorBoundary = (props: React.PropsWithChildren) => {
  return <ErrorBoundary fallback={<div>Error</div>}>{props.children}</ErrorBoundary>;
};

export const Routes = () => {
  const wrap = (element: React.ReactNode) => {
    return (
      <RouteErrorBoundary>
        <RouteSuspense>{element}</RouteSuspense>
      </RouteErrorBoundary>
    );
  };

  return (
    <InternalRoutes>
      <Route index element={wrap(<Chat />)} />
      <Route path="/chats/:id?/:anchor?" element={wrap(<Chat />)} />
      <Route path="/knowledge" element={wrap(<Knowledge />)} />
      <Route path="/knowledge-files/:id" element={wrap(<KnowledgeFiles />)} />
      <Route path="/knowledge/collection-form/:id?" element={wrap(<KnowledgeCollectionForm />)} />
      <Route path="/tool" element={wrap(<Tools />)} />
      <Route path="/apps/:key" element={wrap(<AppLoader />)} />
      <Route path="/bookmarks" element={wrap(<Bookmarks />)} />
      <Route path="/bookmarks/:id" element={wrap(<Bookmark />)} />
      <Route path="/user/login" element={wrap(<Login />)} />
      <Route path="/user/register" element={wrap(<Register />)} />
      <Route path="/user/account" element={wrap(<Account />)} />
      <Route path="/usage" element={wrap(<Usage />)} />
      <Route path="/prompts" element={wrap(<Prompts />)} />
      <Route path="/prompts/form/:id?" element={wrap(<PromptForm />)} />
      <Route path="/settings" element={wrap(<Settings />)} />
      <Route path="/providers" element={wrap(<Providers />)} />
      <Route path="/providers-next" element={wrap(<ProvidersNext />)} />
      <Route path="/conversation" element={wrap(<Conversation />)} />
    </InternalRoutes>
  );
};
