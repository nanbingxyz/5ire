import {
  Avatar,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  MenuDivider,
  MenuProps,
  Button,
  Persona,
} from "@fluentui/react-components";
import Mousetrap from "mousetrap";
import {
  bundleIcon,
  DataUsage24Regular,
  Fire24Regular,
  Fire24Filled,
  ReceiptSparkles24Regular,
  Settings24Regular,
  SignOut24Regular,
  LayerDiagonalSparkle24Regular,
} from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";
import useNav from "hooks/useNav";
import { useEffect, useState } from "react";
import useToast from "hooks/useToast";
import useAuthStore from "stores/useAuthStore";

// const debug = Debug('5ire:components:layout:aside:WorkspaceMenu');

const FireIcon = bundleIcon(Fire24Filled, Fire24Regular);

/**
 * WorkspaceMenu component that renders a dropdown menu with workspace navigation options,
 * user profile information, and application settings. Supports both collapsed and expanded states.
 *
 * @param {Object} props - Component properties
 * @param {boolean} props.collapsed - Whether the menu should be displayed in collapsed mode
 * @returns {JSX.Element} The rendered workspace menu component
 */
export default function WorkspaceMenu({ collapsed }: { collapsed: boolean }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const navigate = useNav();
  const { notifySuccess, notifyError } = useToast();
  const user = useAuthStore((state) => state.user);

  /**
   * Navigates to the appropriate user profile page based on authentication status.
   * Redirects to login if user is not authenticated, otherwise goes to account page.
   */
  const navToProfile = () => {
    if (!user) {
      navigate("/user/login");
    } else {
      navigate("/user/account");
    }
    setOpen(false);
  };

  /**
   * Signs out the current user and handles the sign-out process.
   * Shows success or error notifications based on the operation result.
   */
  const signOut = async () => {
    const { error } = await useAuthStore.getState().signOut();
    if (error) {
      notifyError(error.message);
    } else {
      notifySuccess(t("Notification.SignOutSuccess"));
      navigate("/user/login");
    }
  };

  /**
   * Handles menu open/close state changes.
   *
   * @param {Event} e - The event object
   * @param {Object} data - Menu state data containing open status
   * @param {boolean} data.open - Whether the menu is open
   */
  const onOpenChange: MenuProps["onOpenChange"] = (e, data) => {
    setOpen(data.open);
  };

  /**
   * Sets up keyboard shortcuts for navigation and cleans them up on component unmount.
   * Binds mod+, for settings, mod+k for providers, and mod+p for prompts.
   */
  useEffect(() => {
    Mousetrap.bind("mod+,", () => navigate("/settings"));
    Mousetrap.bind("mod+k", () => navigate("/providers"));
    Mousetrap.bind("mod+p", () => navigate("/prompts"));
    return () => {
      Mousetrap.unbind("mod+,");
      Mousetrap.unbind("mod+k");
      Mousetrap.unbind("mod+p");
    };
  }, []);

  return (
    <div className="pr-0.5">
      <Menu open={open} onOpenChange={onOpenChange}>
        <div
          className={`${collapsed ? "" : "flex items-center justify-between "}`}
        >
          <MenuTrigger disableButtonEnhancement>
            <MenuButton
              icon={<FireIcon />}
              appearance="transparent"
              style={{ borderColor: "transparent", boxShadow: "none" }}
              className="w-full justify-start outline-none"
              onClick={() => setOpen(true)}
            >
              {collapsed ? null : t("Common.Workspace")}
            </MenuButton>
          </MenuTrigger>
          {collapsed ||
            (user && (
              <Button
                className="ml-5"
                onClick={() => navigate("/user/account")}
                appearance="subtle"
                icon={
                  <Avatar
                    aria-label={t("Common.User")}
                    name={user.user_metadata.name}
                    color="colorful"
                    size={24}
                  />
                }
              />
            ))}
        </div>
        <MenuPopover className="w-full" style={{ width: "254px" }}>
          <Button
            onClick={navToProfile}
            appearance="subtle"
            className="w-full justify-start"
          >
            <div className="px-0 py-1.5">
              {user ? (
                <div className="flex justify-start flex-nowrap items-center">
                  <Persona
                    size="large"
                    name={user.user_metadata.name}
                    secondaryText={user.email}
                    avatar={
                      <Avatar
                        aria-label={t("Common.User")}
                        name={user.user_metadata.name}
                        color="colorful"
                        className="mr-2"
                        shape="square"
                        size={40}
                      />
                    }
                  />
                </div>
              ) : (
                <div className="flex justify-start flex-nowrap items-center">
                  <Avatar
                    aria-label={t("Common.Guest")}
                    className="mr-2"
                    shape="square"
                    size={40}
                  />
                  <span>{t("Common.SignIn")}</span>
                </div>
              )}
            </div>
          </Button>
          <MenuList>
            <MenuDivider className="border-base" />
            <MenuItem
              title="mod+k"
              icon={<LayerDiagonalSparkle24Regular />}
              onClick={() => {
                navigate("/providers");
              }}
            >
              <div className="flex justify-between items-center">
                {t("Common.Providers")}
                <span className="text-xs tips">MOD + k</span>
              </div>
            </MenuItem>
            <MenuItem
              title="mod+,"
              icon={<Settings24Regular />}
              onClick={() => {
                navigate("/settings");
              }}
            >
              <div className="flex justify-between items-center">
                {t("Common.Settings")}
                <span className="text-xs tips">MOD + ,</span>
              </div>
            </MenuItem>
            <MenuItem
              icon={<ReceiptSparkles24Regular />}
              onClick={() => {
                navigate("/prompts");
              }}
            >
              <div className="flex justify-between items-center">
                {t("Common.Prompts")}
                <span className="text-xs tips">MOD + p</span>
              </div>
            </MenuItem>
            <MenuItem
              icon={<DataUsage24Regular />}
              onClick={() => {
                navigate("/usage");
              }}
            >
              {t("Common.Analytics")}
            </MenuItem>
            {user ? (
              <div>
                <MenuDivider />
                <MenuItem icon={<SignOut24Regular />} onClick={signOut}>
                  {t("Common.SignOut")}
                </MenuItem>
              </div>
            ) : null}
          </MenuList>
        </MenuPopover>
      </Menu>
    </div>
  );
}
