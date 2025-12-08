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
import { asError } from "catch-unknown";
import { forwardRef, useImperativeHandle, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import useMarkdown from "@/hooks/useMarkdown";
import useToast from "@/hooks/useToast";
import type { ServerApprovalPolicy, ServerTransport } from "@/main/database/types";
import { useServersRef } from "@/renderer/next/hooks/remote/use-servers";

export type ServerEditDialogInstance = {
  openCreateMode: (type: "local" | "remote") => void;
  openUpdateMode: (id: string) => void;
};

export const ServerEditDialog = forwardRef<ServerEditDialogInstance>((_, ref) => {
  const { t } = useTranslation();
  const { notifyError } = useToast();
  const { render } = useMarkdown();

  const refServers = useServersRef();

  const [open, setOpen] = useState(false);

  const [serverId, setServerId] = useState<string>();
  const [serverLabel, setServerLabel] = useState<string>("");
  const [serverDescription, setServerDescription] = useState<string>("");
  const [serverConfig, setServerConfig] = useState<Record<string, string>>({});
  const [serverEndpoint, setServerEndpoint] = useState<string>("");
  const [serverTransport, setServerTransport] = useState<ServerTransport>("stdio");
  const [serverApprovalPolicy, setServerApprovalPolicy] = useState<ServerApprovalPolicy>("always");
  const [serverActive, setServerActive] = useState(false);

  const [configKey, setConfigKey] = useState<string>();
  const [configValue, setConfigValue] = useState<string>();

  const [validationsErrorsVisible, setValidationsErrorsVisible] = useState(false);

  const serverLabelValidation = useMemo(() => {
    if (serverLabel) {
      return {};
    }

    return {
      validationState: "error",
      validationMessage: `${t("Common.Required")}`,
    } as const;
  }, [serverLabel, t]);

  const serverEndpointValidation = useMemo(() => {
    if (serverTransport === "stdio") {
      if (!serverEndpoint) {
        return {
          validationState: "error",
          validationMessage: `${t("Tools.Hint.CommandIsRequired")}, like: npx -y @mcp-server"`,
        } as const;
      }
    } else {
      if (!serverEndpoint) {
        return {
          validationState: "error",
          validationMessage: `${t("Tools.Hint.UrlIsRequired")}`,
        } as const;
      }

      let valid = false;

      try {
        valid = ["http:", "https:"].includes(new URL(serverEndpoint).protocol);
      } catch {}

      if (!valid) {
        return {
          validationState: "error",
          validationMessage: `${t("Common.URLInvalid")}`,
        } as const;
      }
    }

    return {};
  }, [serverEndpoint, serverTransport, t]);

  useImperativeHandle(ref, () => {
    return {
      openCreateMode: (type) => {
        setServerId(undefined);
        setServerLabel("");
        setServerDescription("");
        setServerConfig({});
        setServerApprovalPolicy("always");
        setServerEndpoint("");
        setServerTransport(type === "local" ? "stdio" : "http-streamable");
        setServerActive(false);
        setOpen(true);
        setValidationsErrorsVisible(false);
        setConfigValue("");
        setConfigKey("");
      },
      openUpdateMode: (id: string) => {
        const server = refServers.current.getState().rows.find((s) => {
          return s.id === id;
        });

        if (!server) {
          return;
        }

        setServerId(server.id);
        setServerLabel(server.label);
        setServerDescription(server.description || "");
        setServerConfig(server.config);
        setServerApprovalPolicy(server.approvalPolicy);
        setServerEndpoint(server.endpoint);
        setServerTransport(server.transport);
        setServerActive(server.active);
        setOpen(true);
        setValidationsErrorsVisible(false);
        setConfigValue("");
        setConfigKey("");
      },
    };
  });

  const handleSubmit = () => {
    setValidationsErrorsVisible(true);

    if (serverLabelValidation.validationState === "error" || serverEndpointValidation.validationState === "error") {
      return;
    }

    Promise.resolve()
      .then(async () => {
        if (serverId) {
          return window.bridge.mcpServersManager.updateServer({
            id: serverId,
            config: serverConfig,
            label: serverLabel,
            endpoint: serverEndpoint,
            approvalPolicy: serverApprovalPolicy,
          });
        } else {
          return window.bridge.mcpServersManager.createServer({
            config: serverConfig,
            label: serverLabel,
            endpoint: serverEndpoint,
            approvalPolicy: serverApprovalPolicy,
            transport: serverTransport,
            active: serverActive,
          });
        }
      })
      .then(() => {
        handleClose();
      })
      .catch((error) => {
        notifyError(asError(error).message);
      });
  };

  const handleClose = () => {
    setOpen(false);
  };

  const handleAddConfigRecord = () => {
    if (!configKey || !configValue) {
      return;
    }

    setServerConfig((prev) => {
      return {
        ...prev,
        ...{
          [configKey]: configValue,
        },
      };
    });

    setConfigKey("");
    setConfigValue("");
  };

  const handleRemoveConfigRecord = (key: string) => {
    setServerConfig((prev) => {
      const newConfig = { ...prev };
      delete newConfig[key];
      return newConfig;
    });
  };

  const renderPreviewConfig = () => {
    const json: Record<string, unknown> = {};

    json.id = serverId || "-";
    json.lebel = serverLabel || "-";
    json.description = serverDescription || "-";
    json.type = serverTransport === "stdio" ? "local" : "remote";

    if (serverTransport === "stdio") {
      const [command, ...args] = serverEndpoint.split(" ");
      json.command = command;
      json.arguments = args;
      json.env = serverConfig;
    } else {
      json.url = serverEndpoint;
      json.headers = serverConfig;
      json.transport = serverTransport === "http-streamable" ? "stream" : "sse";
    }

    json.approval_policy = serverApprovalPolicy;
    json.is_active = serverActive;

    return JSON.stringify(json, null, 2);
  };

  const renderTitle = () => {
    return (
      <DialogTitle
        action={
          <DialogTrigger action="close">
            <Button onClick={handleClose} appearance="subtle" aria-label="close" icon={<Dismiss24Regular />} />
          </DialogTrigger>
        }
      >
        <div className="flex flex-start justify-start items-baseline gap-2">
          <span>{serverId ? t("Tools.Edit") : t("Tools.New")}</span>
          <span className="text-sm text-gray-500">
            ({serverTransport === "stdio" ? t("Tools.LocalServer") : t("Tools.RemoteServer")})
          </span>
        </div>
      </DialogTitle>
    );
  };

  const renderContent = () => {
    return (
      <DialogContent className="flex flex-col gap-4">
        {/*label*/}
        <Field label={t("Tools.Name")} {...(validationsErrorsVisible ? serverLabelValidation : {})}>
          <Input
            className="w-full min-w-fit"
            placeholder={t("Common.Required")}
            value={serverLabel}
            onChange={(_, data) => {
              setServerLabel(data.value);
            }}
            maxLength={64}
          />
        </Field>
        {/*description*/}
        <Field label={t("Common.Description")}>
          <Input
            className="w-full min-w-fit"
            placeholder={t("Common.Optional")}
            value={serverDescription}
            onChange={(_, data) => {
              setServerDescription(data.value);
            }}
            maxLength={128}
          />
        </Field>

        {/*approval policy*/}
        <Field
          label={t("Tools.ApprovalPolicy")}
          validationMessage={serverApprovalPolicy === "once" ? `${t("Tools.ApprovalPolicy.Once.Hint")}` : undefined}
          validationState="none"
        >
          <RadioGroup
            value={serverApprovalPolicy}
            layout="horizontal"
            onChange={(_, data) => {
              setServerApprovalPolicy(data.value as ServerApprovalPolicy);
            }}
          >
            <Radio key="never" value="never" label={t("Tools.ApprovalPolicy.Never")} />
            <Radio key="always" value="always" label={t("Tools.ApprovalPolicy.Always")} />
            <Radio key="once" value="once" label={t("Tools.ApprovalPolicy.Once")} />
          </RadioGroup>
        </Field>

        {/*endpoint*/}
        <Field
          label={serverTransport === "stdio" ? t("Tools.Command") : t("Common.URL")}
          {...(validationsErrorsVisible ? serverEndpointValidation : {})}
        >
          <Input
            className="w-full min-w-fit"
            placeholder={t("Common.Required")}
            value={serverEndpoint}
            onChange={(_, data) => {
              setServerEndpoint(data.value);
            }}
            maxLength={128}
          />
        </Field>

        {/*config*/}
        <Field label={serverTransport === "stdio" ? t("Tools.EnvVars") : t("Common.HttpHeaders")}>
          <div className="bg-gray-50 dark:bg-neutral-800 border rounded border-base">
            <div className="flex flex-start items-center border-b border-base px-1 py-1">
              {serverTransport === "stdio" ? (
                <>
                  <div className="w-5/12">{t("Common.EnvName")}</div>
                  <div className="w-6/12">{t("Common.EnvValue")}</div>
                </>
              ) : (
                <>
                  <div className="w-5/12">{t("Common.Name")}</div>
                  <div className="w-6/12">{t("Common.Value")}</div>
                </>
              )}

              <div />
            </div>
            <div className="flex flex-start items-center border-b border-base px-1 p-1">
              <div className="w-5/12 px-1">
                <Input
                  className="w-full"
                  size="small"
                  value={configKey || ""}
                  onChange={(_, data) => {
                    setConfigKey(data.value);
                  }}
                />
              </div>
              <div className="w-6/12 px-1">
                <Input
                  className="w-full"
                  size="small"
                  value={configValue || ""}
                  onChange={(_, data) => {
                    setConfigValue(data.value);
                  }}
                />
              </div>
              <div>
                <Button appearance="subtle" onClick={handleAddConfigRecord} icon={<AddCircleRegular />} size="small" />
              </div>
            </div>
            <div className="overflow-y-auto min-h-6 max-h-40 flex flex-col">
              {Object.entries(serverConfig).map(([key, value]) => (
                <div key={key} className="flex flex-start items-center [&:not(:last-child)]:border-b px-1">
                  <div className="w-[215px] mx-1.5 text-xs overflow-hidden text-nowrap truncate flex-grow-0">{key}</div>
                  <div className="w-[261px] mx-1 text-xs overflow-hidden text-nowrap truncate flex-grow-0">{value}</div>
                  <div>
                    <Button
                      appearance="subtle"
                      icon={<SubtractCircleRegular />}
                      size="small"
                      onClick={() => {
                        handleRemoveConfigRecord(key);
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Field>
        <div>
          <Field label={t("Tools.ConfigPreview")} hint="in JSON format">
            <div
              className="border rounded border-base text-xs"
              // biome-ignore lint/security/noDangerouslySetInnerHtml: x
              dangerouslySetInnerHTML={{
                __html: render(`\`\`\`json\n${renderPreviewConfig()}\n\`\`\``),
              }}
            />
          </Field>
        </div>
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
