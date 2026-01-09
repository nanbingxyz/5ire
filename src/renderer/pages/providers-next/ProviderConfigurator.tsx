import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  DialogTrigger,
  Field,
  Input,
  Radio,
  RadioGroup,
} from "@fluentui/react-components";
import { AddCircleRegular, Dismiss24Regular, SubtractCircleRegular } from "@fluentui/react-icons";
import { forwardRef, useCallback, useImperativeHandle, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ProviderKind, ServerApprovalPolicy } from "@/main/database/types";
import type { Provider } from "@/main/llm/provider";
import { ProvidersManager } from "@/main/services/providers-manager";
import MaskableInput from "@/renderer/components/MaskableInput";
import { useLiveProvidersRef } from "@/renderer/next/hooks/remote/use-live-providers";
import { getBuiltinProviderLabel } from "@/renderer/pages/providers-next/utils";

export type ProviderConfiguratorInstance = {
  openConfigureBuiltinMode(kind: Exclude<ProviderKind, "openai-compatible">): void;
  openCreateCustomMode(): void;
  openUpdateCustomMode(id: string): void;
};

type Mode = ["configure", Exclude<ProviderKind, "openai-compatible">] | ["create"] | ["update", string];

export const ProviderConfigurator = forwardRef<ProviderConfiguratorInstance>((_, ref) => {
  const { t } = useTranslation();

  const refLiveProviders = useLiveProvidersRef();

  const [open, setOpen] = useState(false);

  const [mode, setMode] = useState<Mode>(["create"]);
  const [parameters, setParameters] = useState<Record<string, string>>({});
  const [parametersSchema, setParametersSchema] = useState<Provider.Parameter[]>([]);

  const [proxy, setProxy] = useState<string>("");

  const [label, setLabel] = useState<string>("");
  // const [description, setDescription] = useState("");

  const [validationsErrorsVisible, setValidationsErrorsVisible] = useState(false);

  const labelValidation = useMemo(() => {
    if (label.trim()) {
      return {};
    }

    return {
      validationState: "error",
      validationMessage: `${t("Common.Required")}`,
    } as const;
  }, [label, t]);

  const proxyValidation = useMemo(() => {
    if (!proxy.trim()) {
      return {};
    }

    try {
      new URL(proxy);
    } catch {
      return {
        validationState: "error",
        validationMessage: `${t("Provider.Proxy.Invalid")}`,
      } as const;
    }

    return {};
  }, [proxy, t]);

  const parametersValidation = useMemo(() => {
    const errors: Record<string, string | undefined> = {};

    for (const item of parametersSchema) {
      if (item.required && !parameters[item.key]?.trim()) {
        errors[item.key] = `${t("Common.Required")}`;
      }
    }

    return errors;
  }, [parameters, parametersSchema, t]);

  const loadParametersSchema = (kind: ProviderKind, init: Record<string, string> = {}) => {
    window.bridge.providersManager.getProviderParameters(kind).then((schema) => {
      setParametersSchema(schema);
      setParameters(() => {
        const merged = { ...init };

        for (const item of schema) {
          if (item.default && !merged[item.key]) {
            merged[item.key] = item.default;
          }
        }

        return merged;
      });
    });
  };

  useImperativeHandle(ref, () => {
    return {
      openConfigureBuiltinMode(kind) {
        let parameters: Record<string, string> = {};
        let proxy: string = "";

        const provider = refLiveProviders.current.getState().find((provider) => {
          return provider.kind === kind;
        });

        if (provider) {
          parameters = provider.config.parameters;
          proxy = provider.config.proxy || "";
        }

        setMode(["configure", kind]);
        setProxy(proxy);
        setLabel(getBuiltinProviderLabel(kind));
        setOpen(true);
        loadParametersSchema(kind, parameters);
      },
      openCreateCustomMode() {
        setMode(["create"]);
        setProxy("");
        setLabel("");
        setOpen(true);
        loadParametersSchema("openai-compatible");
      },
      openUpdateCustomMode(id) {
        const provider = refLiveProviders.current.getState().find((provider) => {
          return provider.id === id;
        });

        if (provider) {
          setMode(["update", id]);
          setProxy(provider.config.proxy || "");
          setLabel(provider.label);
          setOpen(true);
          loadParametersSchema(provider.kind, provider.config.parameters);
        }
      },
    };
  });

  const handleClose = () => {
    setOpen(false);
  };

  const handleSubmit = () => {
    setValidationsErrorsVisible(true);

    if (labelValidation.validationState === "error" || proxyValidation.validationState === "error") {
      return;
    }

    if (parametersValidation) {
      for (const key in parametersValidation) {
        if (parametersValidation[key]) {
          return;
        }
      }
    }

    const data = {
      proxy: proxy.trim() ? proxy.trim() : undefined,
      parameters: parameters,
      label: label,
    };

    let promise: Promise<void>;

    if (mode[0] === "configure") {
      const kind = mode[1];
      const id = refLiveProviders.current.getState().find((provider) => {
        return provider.kind === kind;
      })?.id;

      if (id) {
        promise = window.bridge.providersManager.updateProvider({
          ...{ id },
          ...data,
        });
      } else {
        promise = window.bridge.providersManager.createProvider({
          ...{ kind },
          ...data,
        });
      }
    } else {
      if (mode[0] === "update") {
        const id = mode[1];
        promise = window.bridge.providersManager.updateProvider({
          ...{ id },
          ...data,
        });
      } else {
        promise = window.bridge.providersManager.createProvider({
          ...{ kind: "openai-compatible" },
          ...data,
        });
      }
    }

    promise
      .then(() => {
        handleClose();
      })
      .catch((error) => {
        console.log(error);
      });
  };

  const renderTitle = () => {
    const title =
      mode[0] === "configure"
        ? t("Provider.Configure")
        : mode[0] === "create"
          ? t("Provider.Create")
          : mode[0] === "update"
            ? t("Provider.Update")
            : "";

    return (
      <DialogTitle
        action={
          <DialogTrigger action="close">
            <Button onClick={handleClose} appearance="subtle" aria-label="close" icon={<Dismiss24Regular />} />
          </DialogTrigger>
        }
      >
        <div className="flex flex-start justify-start items-baseline gap-2">
          <span>{title}</span>
        </div>
      </DialogTitle>
    );
  };

  const renderContent = () => {
    return (
      <DialogContent className="flex flex-col gap-4">
        {/*label*/}
        <Field label={t("Common.Name")} {...(validationsErrorsVisible ? labelValidation : {})}>
          <Input
            className="w-full min-w-fit"
            placeholder={t("Common.Required")}
            value={label}
            onChange={(_, data) => {
              setLabel(data.value);
            }}
            maxLength={64}
            disabled={mode[0] === "configure"}
          />
        </Field>

        {/*description*/}
        {/*<Field label={t("Common.Description")}>*/}
        {/*  <Input*/}
        {/*    className="w-full min-w-fit"*/}
        {/*    placeholder={t("Common.Optional")}*/}
        {/*    value={description}*/}
        {/*    onChange={(_, data) => {*/}
        {/*      setDescription(data.value);*/}
        {/*    }}*/}
        {/*    maxLength={128}*/}
        {/*  />*/}
        {/*</Field>*/}

        {parametersSchema.map((item) => {
          const Component = item.secret ? (MaskableInput as typeof Input) : Input;

          const validationMessage = validationsErrorsVisible ? parametersValidation[item.key] : undefined;
          const label = t(`Provider.Parameter.Label.${item.key}`);
          const placeholder = t(`Provider.Parameter.Placeholder.${item.key}`);

          return (
            <Field
              key={item.key}
              label={label}
              {...(validationMessage ? { validationMessage, validationState: "error" } : {})}
            >
              <Component
                className="w-full min-w-fit"
                placeholder={placeholder}
                value={parameters[item.key] || ""}
                onChange={(_, data) => {
                  setParameters((prev) => ({
                    ...prev,
                    ...{
                      [item.key]: data.value,
                    },
                  }));
                }}
              />
            </Field>
          );
        })}

        {/*proxy*/}
        <Field label={t("Common.Proxy")} {...(validationsErrorsVisible ? proxyValidation : {})}>
          <Input
            className="w-full min-w-fit"
            placeholder={t("Common.Placeholder.Proxy")}
            value={proxy}
            onChange={(_, data) => {
              setProxy(data.value);
            }}
          />
        </Field>

        {/*/!*approval policy*!/*/}
        {/*<Field*/}
        {/*  label={t("Tools.ApprovalPolicy")}*/}
        {/*  validationMessage={serverApprovalPolicy === "once" ? `${t("Tools.ApprovalPolicy.Once.Hint")}` : undefined}*/}
        {/*  validationState="none"*/}
        {/*>*/}
        {/*  <RadioGroup*/}
        {/*    value={serverApprovalPolicy}*/}
        {/*    layout="horizontal"*/}
        {/*    onChange={(_, data) => {*/}
        {/*      setServerApprovalPolicy(data.value as ServerApprovalPolicy);*/}
        {/*    }}*/}
        {/*  >*/}
        {/*    <Radio key="never" value="never" label={t("Tools.ApprovalPolicy.Never")} />*/}
        {/*    <Radio key="always" value="always" label={t("Tools.ApprovalPolicy.Always")} />*/}
        {/*    <Radio key="once" value="once" label={t("Tools.ApprovalPolicy.Once")} />*/}
        {/*  </RadioGroup>*/}
        {/*</Field>*/}
      </DialogContent>
    );
  };

  return (
    <Dialog open={open}>
      <DialogSurface mountNode={document.body.querySelector("#portal")}>
        <DialogBody>
          {renderTitle()}
          {renderContent()}

          <DialogActions>
            <Button appearance="subtle" onClick={handleClose}>
              {t("Common.Cancel")}
            </Button>
            <Button type="submit" appearance="primary" onClick={handleSubmit}>
              {t("Common.Save")}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
});
