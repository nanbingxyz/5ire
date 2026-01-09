import {
  Button,
  Field,
  Label,
  MenuItem,
  MenuList,
  Popover,
  PopoverSurface,
  PopoverTrigger,
  Slider,
} from "@fluentui/react-components";
import {
  AttachText20Filled,
  AttachText20Regular,
  bundleIcon,
  CheckmarkFilled,
  ChevronDownRegular,
  ChevronRightFilled,
  NumberSymbolSquare20Filled,
  NumberSymbolSquare20Regular,
  Temperature20Filled,
  Temperature20Regular,
} from "@fluentui/react-icons";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import Spinner from "@/renderer/components/Spinner";
import { useLiveProviders } from "@/renderer/next/hooks/remote/use-live-providers";

export type EditorToolbarProps = {
  config: {
    model?: {
      provider: string;
      name: string;
    };
  };
  onModelSelected?: (model: Exclude<EditorToolbarProps["config"]["model"], undefined>) => void;
};

const TemperatureIcon = bundleIcon(Temperature20Filled, Temperature20Regular);
const NumberSymbolSquareIcon = bundleIcon(NumberSymbolSquare20Filled, NumberSymbolSquare20Regular);
const AttacheTextIcon = bundleIcon(AttachText20Filled, AttachText20Regular);

// TODO: Add models filter
export default function EditorToolbar(props: EditorToolbarProps) {
  const { t } = useTranslation();

  const providers = useLiveProviders();
  const models =
    providers.find((provider) => provider.id === props.config.model?.provider && provider.status.type === "ready")
      ?.models || [];

  const [selectedProvider, setSelectedProvider] = useState(props.config.model?.provider);

  const provider = providers.find((provider) => provider.id === selectedProvider);
  const model = models.find((model) => model.name === props.config.model?.name);

  // const renderSliderValuePopover = (props: {
  //   value: number,
  //   range: [number, number],
  //   trigger: React.ReactNode
  // }) => {
  //   return <Popover trapFocus withArrow>
  //     <PopoverTrigger disableButtonEnhancement>
  //       {trigger}
  //     </PopoverTrigger>
  //     <PopoverSurface aria-labelledby="temperature">
  //       <div className="w-80">
  //         <Field label={`${t('Common.Temperature')} (${temperature})`}>
  //           <div className="flex items-center p-1.5">
  //             <Label aria-hidden>{minTemperature}</Label>
  //             <Slider
  //               id="chat-temperature"
  //               step={0.1}
  //               min={minTemperature}
  //               max={maxTemperature}
  //               value={temperature}
  //               className="flex-grow"
  //               onChange={updateTemperature}
  //             />
  //             <span>{maxTemperature}</span>
  //           </div>
  //           <div className="tips text-xs">
  //             {t(
  //               `Higher values like ${
  //                 maxTemperature - 0.2
  //               } will make the output more creative and unpredictable, while lower values like ${
  //                 minTemperature + 0.2
  //               } will make it more precise.`,
  //             )}
  //           </div>
  //         </Field>
  //       </div>
  //     </PopoverSurface>
  //   </Popover>
  // }

  const renderMaxOutputTokensController = () => {};

  const renderMaxContextMessagesController = () => {};

  const renderTemperatureController = () => {};

  return (
    <div className="py-1.5 flex items-center gap-2 pl-2">
      <Popover positioning={"above-start"} mountNode={document.body.querySelector("#portal")}>
        <PopoverTrigger disableButtonEnhancement>
          <Button
            title={`${t("Common.Provider")}(Mod+Shift+0)`}
            size="small"
            appearance="transparent"
            iconPosition="after"
            className="justify-start focus-visible:ring-0 focus:right-0 border-none"
            style={{
              padding: "0 4px",
              border: 0,
              boxShadow: "none",
              minWidth: "8px",
            }}
            icon={<ChevronDownRegular className="w-3" style={{ marginBottom: -2 }} />}
          >
            {provider && props.config.model ? (
              <span className="flex items-center gap-1">
                <span>{provider.label}</span>/<span>{props.config.model.name}</span>
              </span>
            ) : (
              <span>Unselected</span>
            )}
          </Button>
        </PopoverTrigger>

        <PopoverSurface tabIndex={-1} style={{ padding: 0 }}>
          <div className="flex items-start">
            <div className="w-[150px] h-[300px] overflow-y-auto scrollbar-hide border-r border-base">
              <MenuList className="w-full">
                {providers.map((provider) => {
                  return (
                    <MenuItem
                      style={{ borderRadius: 0 }}
                      key={provider.id}
                      disabled={false}
                      onClick={() => {
                        setSelectedProvider(provider.id);
                      }}
                    >
                      <div className="flex items-center gap-1">
                        <span className="flex-1">{provider.label}</span>

                        {selectedProvider === provider.id && <ChevronRightFilled />}
                      </div>
                    </MenuItem>
                  );
                })}
              </MenuList>
            </div>
            <div className="w-[250px] h-[300px] overflow-y-auto scrollbar-hide">
              <MenuList className="w-full">
                {provider &&
                  provider.status.type === "ready" &&
                  provider.models.map((model) => {
                    return (
                      <MenuItem
                        style={{ borderRadius: 0 }}
                        key={model.name}
                        onClick={() => {
                          props.onModelSelected?.({ provider: provider.id, name: model.name });
                        }}
                      >
                        <div className="flex items-center gap-1">
                          <span className="truncate">{model.name}</span>
                          <span className="ml-auto"></span>

                          {props.config.model?.name === model.name && <CheckmarkFilled />}
                        </div>
                      </MenuItem>
                    );
                  })}

                {provider && provider.status.type === "loading" && (
                  <div className="w-full h-full flex justify-center items-center">
                    <Spinner size={24} />
                  </div>
                )}

                {provider && provider.status.type === "error" && (
                  <div className="w-full h-full flex justify-center items-center">
                    <span className="text-gray-300">{provider.status.message}</span>
                  </div>
                )}
              </MenuList>
            </div>
          </div>
        </PopoverSurface>
      </Popover>
    </div>
  );
}
