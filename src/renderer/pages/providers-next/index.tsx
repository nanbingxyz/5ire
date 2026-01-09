// import { Button, Menu, MenuButton, MenuItem, MenuList, MenuPopover, MenuTrigger } from "@fluentui/react-components";
// import {
//   AddCircleFilled,
//   AddCircleRegular,
//   bundleIcon,
//   CloudArrowDown20Filled,
//   CloudArrowDown20Regular,
//   CloudArrowUp24Filled,
//   CloudArrowUp24Regular,
//   MoreHorizontal24Filled,
// } from "@fluentui/react-icons";
// import Debug from "debug";
// import useToast from "hooks/useToast";
// import useUI from "hooks/useUI";
// import { useEffect, useMemo, useRef, useState } from "react";
// import { useTranslation } from "react-i18next";
// import StateButton from "renderer/components/StateButton";
// import useAuthStore from "stores/useAuthStore";
// import useProviderStore from "stores/useProviderStore";
// import supabase from "vendors/supa";
// // import ModelList from './ModelList';
// // import ProviderForm from './ProviderForm';
// // import ProviderList from './ProviderList';
// import { captureException } from "../../logging";
//
// const debug = Debug("5ire:pages:providers:index");
//
// const DEFAULT_HEIGHT = 400;
// const HEADER_HEIGHT = 90;
// const LIST_ITEM_HEIGHT = 42;
//
// const AddIcon = bundleIcon(AddCircleFilled, AddCircleRegular);
// const CloudArrowUpIcon = bundleIcon(CloudArrowUp24Filled, CloudArrowUp24Regular);
//
// const CloudArrowDownIcon = bundleIcon(CloudArrowDown20Filled, CloudArrowDown20Regular);
//
// export default function Providers() {
//   const { t } = useTranslation();
//   const user = useAuthStore((state) => state.user);
//   const { overwrite } = useProviderStore();
//   const { heightStyle, calcHeight } = useUI();
//   const { notifyInfo, notifyError, notifySuccess } = useToast();
//   const [updated, setUpdated] = useState(true);
//   const [loading, setLoading] = useState(false);
//   const selectedProvider = useProviderStore((state) => state.provider);
//   const { createProvider } = useProviderStore();
//   const [contentHeight, setContentHeight] = useState(DEFAULT_HEIGHT);
//   const [updatedAtCloud, setUpdatedAtCloud] = useState<string>();
//   const providerFormRef = useRef<HTMLDivElement>(null);
//   const msgBarHeight = useMemo(() => (updatedAtCloud ? 31 : 0), [updatedAtCloud]);
//
//   useEffect(() => {
//     const handleResize = () => {
//       setContentHeight(window.innerHeight - msgBarHeight);
//     };
//     handleResize();
//     window.addEventListener("resize", handleResize);
//     return () => {
//       window.removeEventListener("resize", handleResize);
//     };
//   }, [msgBarHeight]);
//
//   useEffect(() => {
//     if (!user || !updated) {
//       return;
//     }
//     (async () => {
//       try {
//         const { data } = await supabase.from("settings").select("updated_at").eq("id", user.id).maybeSingle();
//         if (data?.updated_at) {
//           const dt = new Date(data.updated_at);
//           setUpdatedAtCloud(dt.toLocaleString());
//           setUpdated(false);
//         } else {
//           setUpdatedAtCloud(undefined);
//         }
//       } catch (error) {
//         debug(error);
//         captureException(error as Error);
//       }
//     })();
//   }, [user, updated, notifyError]);
//
//   const restoreFromCloud = async () => {
//     if (!user) {
//       notifyInfo(t("Auth.Notification.SignInRequired"));
//       return;
//     }
//     setLoading(true);
//     try {
//       const { data, error } = await supabase.from("settings").select("data").eq("id", user.id).maybeSingle();
//       if (error) {
//         notifyError(error.message);
//       } else if (data?.data) {
//         const { iv, encrypted } = data.data;
//         const decrypted = await window.electron.crypto.decrypt(encrypted, user.id, iv);
//         const { providers } = JSON.parse(decrypted);
//         if (providers) {
//           overwrite(providers);
//           notifySuccess(t("Settings.Notification.RestoreFromCloudSuccess"));
//         } else {
//           notifyError(t("Settings.Notification.NoValidBackupFound"));
//         }
//       } else {
//         notifyError(t("Settings.Notification.RestoreFromCloudFailed"));
//       }
//     } catch (error: any) {
//       debug(error);
//       captureException(error);
//     } finally {
//       setLoading(false);
//     }
//   };
//
//   const saveToCloud = async () => {
//     if (!user) {
//       notifyInfo(t("Auth.Notification.SignInRequired"));
//       return;
//     }
//     setLoading(true);
//     try {
//       const providers = window.electron.store.get("providers");
//       const encrypted = await window.electron.crypto.encrypt(JSON.stringify({ providers }), user.id);
//       const { error } = await supabase.from("settings").upsert({ data: encrypted, id: user.id });
//       if (error) {
//         notifyError(error.message);
//       } else {
//         notifySuccess(t("Settings.Notification.SaveToCloudSuccess"));
//         setUpdated(true);
//       }
//     } catch (error: any) {
//       debug(error);
//       captureException(error);
//     } finally {
//       setLoading(false);
//     }
//   };
//
//   return (
//     <div className="page h-full" id="page-settings" style={{ paddingBottom: 0 }}>
//       <div className="page-top-bar" />
//       <div className="page-header border-b border-base -mx-5 px-5" style={{ paddingBottom: 0 }}>
//         <div className="flex justify-between items-center mb-4">
//           <h1 className="text-2xl">{t("Common.Providers")}</h1>
//           <Menu>
//             <MenuTrigger disableButtonEnhancement>
//               <MenuButton disabled={loading} appearance="transparent" icon={<MoreHorizontal24Filled />} />
//             </MenuTrigger>
//             <MenuPopover>
//               <MenuList>
//                 <MenuItem icon={<CloudArrowUpIcon />} onClick={saveToCloud}>
//                   {" "}
//                   {t("Settings.Action.SaveToCloud")}
//                 </MenuItem>
//               </MenuList>
//             </MenuPopover>
//           </Menu>
//         </div>
//         {updatedAtCloud && (
//           <div className="flex animate-in justify-between items-center text-xs py-1 px-5 bg-[#dbe9da] text-[#618d69] dark:bg-[#2b5239] dark:text-[#b3c1b8] border-t border-[#618d69]/10 dark:border-green-900 -mx-5">
//             <span className="latin">
//               {t("Settings.Info.UpdatedAtCloud")}&nbsp;{updatedAtCloud}
//             </span>
//             <StateButton
//               size="small"
//               loading={loading}
//               appearance="subtle"
//               icon={<CloudArrowDownIcon />}
//               onClick={restoreFromCloud}
//             >
//               {t("Settings.Action.DownloadFromCloud")}
//             </StateButton>
//           </div>
//         )}
//       </div>
//
//       <div
//         className="-ml-5 -mr-5 grid grid-cols-4"
//         style={{
//           height: heightStyle(contentHeight - HEADER_HEIGHT),
//         }}
//       >
//         <div
//           className="border-r border-base relative "
//           style={{
//             height: heightStyle(contentHeight - HEADER_HEIGHT),
//           }}
//         >
//           {/*<ProviderList*/}
//           {/*  height={calcHeight(*/}
//           {/*    contentHeight - (HEADER_HEIGHT + LIST_ITEM_HEIGHT),*/}
//           {/*  )}*/}
//           {/*/>*/}
//           <div className="absolute p-2 bottom-0 left-0 right-0 border-t border-base bg-white dark:bg-zinc-800/50">
//             <Button
//               size="small"
//               appearance="subtle"
//               className="w-full"
//               onClick={() => {
//                 createProvider();
//               }}
//               icon={<AddIcon />}
//             >
//               <div className="overflow-hidden text-ellipsis whitespace-nowrap font-semibold">
//                 {t("Provider.OpenAICompatible")}
//               </div>
//             </Button>
//           </div>
//         </div>
//         <div className="col-span-3 h-full">
//           {selectedProvider && (
//             <div>
//               {/*<div ref={providerFormRef}>*/}
//               {/*  <ProviderForm />*/}
//               {/*</div>*/}
//               {/*<ModelList*/}
//               {/*  height={calcHeight(*/}
//               {/*    contentHeight -*/}
//               {/*    HEADER_HEIGHT -*/}
//               {/*    (providerFormRef.current?.offsetHeight || 153),*/}
//               {/*  )}*/}
//               {/*/>*/}
//             </div>
//           )}
//         </div>
//       </div>
//     </div>
//   );
// }

import { Button } from "@fluentui/react-components";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  ProviderConfigurator,
  type ProviderConfiguratorInstance,
} from "@/renderer/pages/providers-next/ProviderConfigurator";
import ProvidersGrid from "@/renderer/pages/providers-next/ProviderList";

export default function Knowledge() {
  const { t } = useTranslation();

  const refProviderConfigurator = useRef<ProviderConfiguratorInstance | null>(null);

  return (
    <div className="page h-full">
      <div className="page-top-bar" />
      <div className="page-header">
        <div className="flex items-center justify-between w-full">
          <h1 className="text-2xl flex-shrink-0 mr-6">{t("Common.Providers")}</h1>
          <div className="flex justify-end w-full items-center gap-2">
            <Button appearance="primary" onClick={() => refProviderConfigurator.current?.openCreateCustomMode()}>
              {t("Common.New")}
            </Button>
          </div>
        </div>
      </div>
      <div className="mt-2.5 pb-12 h-full -mr-5 overflow-y-auto">
        <div className="mr-5 flex justify-start gap-2 flex-wrap">{<ProvidersGrid />}</div>
      </div>

      <ProviderConfigurator ref={refProviderConfigurator} />
    </div>
  );
}
