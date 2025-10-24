/**
 * Sidebar component that renders the application's main navigation sidebar.
 * Adapts its appearance and content based on the current route, platform, and user preferences.
 *
 * @returns {JSX.Element} The rendered sidebar component with appropriate navigation and styling
 */

import clsx from "clsx";
import usePlatform from "hooks/usePlatform";
import { useLocation } from "react-router-dom";
import useAppearanceStore from "stores/useAppearanceStore";
import AppNav from "./AppNav";
import ChatNav from "./ChatNav";
import Footer from "./Footer";
import GlobalNav from "./GlobalNav";

import "./AppSidebar.scss";
import BookmarkNav from "./BookmarkNav";

/**
 * Main sidebar component that provides navigation for the application.
 * Handles responsive design, platform-specific styling, and route-based navigation rendering.
 * The sidebar can be hidden, collapsed, or expanded based on user preferences and screen size.
 *
 * @returns {JSX.Element} A responsive sidebar with navigation components and footer
 */
export default function Sidebar() {
  const location = useLocation();
  const { isDarwin, isLinux } = usePlatform();
  const sidebar = useAppearanceStore((state) => state.sidebar);
  const width = sidebar.hidden ? "w-0" : "w-auto";
  const left = sidebar.hidden ? "md:left-0" : "-left-64 md:left-0";
  const leftCollapsed = sidebar.hidden ? "-left-64" : "-left-64 md:left-0";

  const collapsed = sidebar.collapsed && !sidebar.folderEditing;

  /**
   * Renders the appropriate navigation component based on the current route.
   * Returns different navigation components for apps, bookmarks, or default chat routes.
   *
   * @returns {JSX.Element} The navigation component corresponding to the active route
   */
  const renderNav = () => {
    const activeRoute = location.pathname.split("/")[1];
    switch (activeRoute) {
      case "apps":
        return <AppNav collapsed={collapsed} />;
      case "bookmarks":
        return <BookmarkNav collapsed={collapsed} />;
      default:
        return <ChatNav collapsed={collapsed} />;
    }
  };

  renderNav();

  let paddingClass = "md:pt-0";
  if (isDarwin) {
    paddingClass = "darwin pt-10";
  } else if (isLinux) {
    paddingClass = "pt-8 md:pt-0";
  }

  return (
    <aside
      className={clsx(
        `shadow-md md:shadow-none z-10 flex-shrink-0 ${paddingClass} ${
          collapsed ? width : "w-64 md:w-[17rem]"
        } fixed inset-y-0 top-0 ${collapsed ? leftCollapsed : left} flex flex-col h-full md:relative app-sidebar`,
      )}
    >
      <div className="flex h-full flex-1 flex-col">
        <GlobalNav collapsed={collapsed} />
        {renderNav()}
        <Footer collapsed={collapsed} />
      </div>
    </aside>
  );
}
