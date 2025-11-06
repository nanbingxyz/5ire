import { ArrowCircleUpFilled } from "@fluentui/react-icons";
import { useNavigate } from "react-router-dom";
import { useUpdater } from "@/renderer/next/hooks/remote/use-updater";
import Spinner from "./Spinner";

export default function UpgradeIndicator() {
  const navigate = useNavigate();
  const updater = useUpdater();

  const handleNavigateToSettings = () => {
    navigate("/settings");
  };

  if (updater.status.type === "idle" || updater.status.type === "not-available") {
    return (
      <div className="upgrade-indicator flex justify-center items-center rounded-full pl-1 pr-2 py-0.5 bg-indigo-100 dark:bg-slate-600/50 text-indigo-800 dark:text-indigo-200 text-xs">
        <span>v{updater.version}</span>
      </div>
    );
  }

  if (updater.status.type === "checking") {
    return (
      <div className="upgrade-indicator flex justify-center items-center rounded-full pl-1 pr-2 py-0.5 bg-indigo-100 dark:bg-slate-600/50 text-indigo-800 dark:text-indigo-200 text-xs">
        <Spinner size={14} className="mr-2" />
        <span>v{updater.version}</span>
      </div>
    );
  }

  if ("updateInfo" in updater.status && updater.status.updateInfo) {
    return (
      <button
        className="upgrade-indicator flex justify-center items-center rounded-full pl-1 pr-2 py-0.5 bg-[#dbe9da] dark:bg-[#2b5239] text-green-800 dark:text-[#cad4cd] text-xs text-nowrap"
        onClick={() => {
          handleNavigateToSettings();
        }}
        type="button"
      >
        <ArrowCircleUpFilled fontSize={14} />
        <span className="ml-1">v{updater.status.updateInfo.version}</span>
      </button>
    );
  }

  return null;
}
