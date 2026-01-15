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
} from "@fluentui/react-components";
import { Dismiss24Regular } from "@fluentui/react-icons";
import { asError } from "catch-unknown";
import { omitBy } from "lodash";
import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import useMarkdown from "@/hooks/useMarkdown";
import useToast from "@/hooks/useToast";
import type { MCPServersManager } from "@/main/services/mcp-servers-manager";
import ListInput from "@/renderer/components/ListInput";
import { fillArgs, FillEnvOrHeaders as fillConfig, getParameters } from "@/utils/mcp";

const ServerTemplateBaseSchema = z.object({
  name: z.string().nullish(),
  key: z.string().nullish(),
  description: z.string().nullish(),
});

const LocalServerTemplateSchema = ServerTemplateBaseSchema.extend({
  command: z.string(),
  args: z.string().array().nullish(),
  env: z.record(z.string()).nullish(),
  // This field is used only for schema discrimination and should not be present in the validated data
  __type__: z.literal("local").default("local"),
});

const RemoteServerTemplateSchema = ServerTemplateBaseSchema.extend({
  url: z.string().url(),
  headers: z.record(z.string()).nullish(),
  // This field is used only for schema discrimination and should not be present in the validated data
  __type__: z.literal("remote").default("remote"),
});

const ServerTemplateSchema = z.union([LocalServerTemplateSchema, RemoteServerTemplateSchema]);

type LocalServerTemplate = z.infer<typeof LocalServerTemplateSchema>;
type RemoteServerTemplate = z.infer<typeof RemoteServerTemplateSchema>;

type RequiredLocalServerTemplate = {
  [P in keyof LocalServerTemplate]-?: Exclude<LocalServerTemplate[P], undefined | null>;
};

type RequiredRemoteServerTemplate = {
  [P in keyof RemoteServerTemplate]-?: Exclude<RemoteServerTemplate[P], undefined | null>;
};

type RequiredServerTemplate = RequiredLocalServerTemplate | RequiredRemoteServerTemplate;

export type ServerInstallerInstance = {
  install: (template: unknown, callback?: () => void) => void;
};

const noop = () => {};

export const ServerInstaller = forwardRef<ServerInstallerInstance>((_, ref) => {
  const { t } = useTranslation();
  const { render } = useMarkdown();
  const { notifyError } = useToast();

  const [template, setTemplate] = useState<RequiredServerTemplate>();
  const [configParameters, setConfigParameters] = useState<Record<string, string>>({});
  const [argumentParameters, setArgumentParameters] = useState<Record<string, string | string[]>>({});
  const [visible, setVisible] = useState(false);

  const [label, setLabel] = useState("");
  const [labelValidationError, setLabelValidationError] = useState<string | null>(null);

  const [errorMessages, setErrorMessages] = useState<Record<"config" | "argument", Record<string, string>>>({
    config: {},
    argument: {},
  });

  const refInstallCallback = useRef(noop);

  useImperativeHandle(ref, () => {
    return {
      install: (template: unknown, callback = noop) => {
        const result = ServerTemplateSchema.safeParse(template);

        if (result.success) {
          const name = result.data.name || result.data.key || "New Server";

          if (result.data.__type__ === "local") {
            setTemplate({
              __type__: "local",

              key: result.data.key || "",
              name,
              description: result.data.description || "",
              command: result.data.command,
              args: result.data.args || [],
              env: result.data.env || {},
            });
          } else {
            setTemplate({
              __type__: "remote",

              key: result.data.key || "",
              name,
              description: result.data.description || "",
              url: result.data.url,
              headers: result.data.headers || {},
            });
          }

          setConfigParameters({});
          setArgumentParameters({});
          setVisible(true);
          setLabel(name);
          setLabelValidationError(null);
          setErrorMessages({
            config: {},
            argument: {},
          });
          refInstallCallback.current = callback;
        } else {
          notifyError(t("Tool.ServerTemplateParseError"));
          noop();
        }
      },
    };
  });

  const variablesInHeaders = useMemo(() => {
    if (template?.__type__ === "remote") {
      return getParameters(Object.values(template.headers)) as Array<{
        name: string;
        type: "string" | "number";
        description: string;
      }>;
    }
  }, [template]);

  const variablesInArguments = useMemo(() => {
    if (template?.__type__ === "local") {
      return getParameters(template.args) as Array<{
        name: string;
        type: "string" | "number" | "list";
        description: string;
      }>;
    }
  }, [template]);

  const variablesInEnvironments = useMemo(() => {
    if (template?.__type__ === "local") {
      return getParameters(Object.values(template.env)) as Array<{
        name: string;
        type: "string" | "number";
        description: string;
      }>;
    }
  }, [template]);

  const templateRendered = useMemo(() => {
    if (!template) {
      return;
    }

    const configTemplate = template.__type__ === "local" ? template.env : template.headers;
    const config: Record<string, string> = fillConfig(
      configTemplate,
      omitBy(configParameters, (value) => {
        return !value || value.length === 0;
      }),
    );

    if (template.__type__ === "local") {
      return {
        type: template.__type__,
        label: template.name,
        description: template.description,
        command: template.command,

        arguments: fillArgs(
          template.args,
          omitBy(argumentParameters, (value) => {
            return !value || value.length === 0;
            // biome-ignore lint/suspicious/noExplicitAny: x
          }) as any,
        ),
        env: config,
      };
    } else {
      return {
        type: template.__type__,
        label: template.name,
        description: template.description,
        url: template.url,
        headers: config,
      };
    }
  }, [template, argumentParameters, configParameters]);

  const templatePreview = useMemo(() => {
    if (!templateRendered) {
      return "null";
    }

    const json: Record<string, unknown> = {};

    json.id = "00000000-0000-0000-0000-000000000000";
    json.lebel = label;
    json.description = templateRendered.description;
    json.type = templateRendered.type;

    if (templateRendered.type === "local") {
      json.command = templateRendered.command;
      json.arguments = templateRendered.arguments;
      json.env = templateRendered.env;
    } else {
      json.url = templateRendered.url;
      json.headers = templateRendered.headers;
    }

    json.approval_policy = "always";
    json.is_active = true;

    return JSON.stringify(json, null, 2);
  }, [templateRendered, label]);

  const validateConfigParameters = () => {
    const result: Record<string, string> = {};

    let variables: Exclude<typeof variablesInHeaders, undefined>;

    if (template?.__type__ === "local") {
      variables = variablesInEnvironments || [];
    } else if (template?.__type__ === "remote") {
      variables = variablesInHeaders || [];
    } else {
      variables = [];
    }

    for (const variable of variables) {
      const value = configParameters[variable.name];

      if (!value?.trim()) {
        result[variable.name] = t("Common.Required");
        continue;
      }

      if (variable.type === "number") {
        if (Number.isNaN(Number(value))) {
          result[variable.name] = t("Common.Validation.MustBeNumber");
        }
      }
    }

    return result;
  };

  const validateArgumentParameters = () => {
    const result: Record<string, string> = {};

    for (const variable of variablesInArguments || []) {
      const value = argumentParameters[variable.name];

      if (!value) {
        result[variable.name] = t("Common.Required");
        continue;
      }

      if (typeof value === "string" && !value.trim()) {
        result[variable.name] = t("Common.Required");
        continue;
      }

      if (Array.isArray(value) && !value.length) {
        result[variable.name] = t("Common.Required");
        continue;
      }

      if (variable.type === "number") {
        if (Number.isNaN(Number(value))) {
          result[variable.name] = t("Common.Validation.MustBeNumber");
        }
      }
    }

    return result;
  };

  const handleClose = useCallback(() => {
    setVisible(false);
    refInstallCallback.current();
  }, []);

  const handleInstall = () => {
    const configValidationErrors = validateConfigParameters();
    const argumentValidationErrors = validateArgumentParameters();

    if (!label?.trim()) {
      return setLabelValidationError(t("Common.Required"));
    }

    if (Object.keys(configValidationErrors).length || Object.keys(argumentValidationErrors).length) {
      setErrorMessages({
        config: configValidationErrors,
        argument: argumentValidationErrors,
      });

      return;
    }

    setErrorMessages({
      config: {},
      argument: {},
    });

    if (!templateRendered) {
      return;
    }

    const options: MCPServersManager.CreateServerOptions = {
      label: label,
      description: templateRendered.description,
      approvalPolicy: "always",
      config: templateRendered.type === "local" ? templateRendered.env : templateRendered.headers,
      // endpoint: templateRendered.type === "local" ? templateRendered.command : templateRendered.url,
      active: true,
      transport: templateRendered.type === "local" ? "stdio" : "http-streamable",
      endpoint: "",
    };

    if (templateRendered.type === "local") {
      options.endpoint = [templateRendered.command, templateRendered.arguments].flat().join(" ");
    } else {
      options.endpoint = templateRendered.url;
    }

    window.bridge.mcpServersManager
      .createServer(options)
      .then(() => {
        handleClose();
      })
      .catch((error) => {
        notifyError(asError(error).message);
      });
  };

  const renderStringInput = (type: "config" | "argument", key: string, placeholder: string) => {
    const setValue = (value: string) => {
      type === "config"
        ? setConfigParameters((prev) => ({
            ...prev,
            [key]: value,
          }))
        : setArgumentParameters((prev) => ({
            ...prev,
            [key]: value,
          }));
    };

    return (
      <Input
        className="w-full"
        placeholder={placeholder}
        onChange={(_, data) => {
          setValue(data.value);
        }}
      />
    );
  };

  const renderListInput = (key: string, placeholder: string) => {
    console.log(key);
    const setValue = (value: string[]) => {
      setArgumentParameters((prev) => ({
        ...prev,
        [key]: value,
      }));
    };
    return <ListInput label={""} placeholder={placeholder} onChange={setValue} />;
  };

  return (
    <Dialog open={visible}>
      <DialogSurface mountNode={document.body.querySelector("#portal")}>
        <DialogBody>
          <DialogTitle
            action={
              <DialogTrigger action="close">
                <Button onClick={handleClose} appearance="subtle" aria-label="close" icon={<Dismiss24Regular />} />
              </DialogTrigger>
            }
          >
            {template?.name}
          </DialogTitle>
          <DialogContent>
            {template && (
              <Field
                label={t("Tools.Name")}
                validationMessage={labelValidationError || undefined}
                validationState={labelValidationError ? "error" : "none"}
              >
                <Input
                  className="w-full min-w-fit"
                  placeholder={t("Common.Required")}
                  value={label}
                  onChange={(_, data) => {
                    setLabel(data.value);
                  }}
                  maxLength={64}
                />
              </Field>
            )}

            {variablesInArguments && variablesInArguments.length > 0 && (
              <div className="mb-4">
                <div className="text-base font-bold mb-1">{t("Common.CommandLineArguments")}</div>
                <div className="flex flex-col gap-2">
                  {variablesInArguments.map((variable) => (
                    <Field
                      label={variable.name}
                      validationMessage={errorMessages.argument[variable.name]}
                      validationState={errorMessages.argument[variable.name] ? "error" : "none"}
                      key={variable.name}
                    >
                      {variable.type === "string" && renderStringInput("argument", variable.name, variable.description)}
                      {variable.type === "number" && renderStringInput("argument", variable.name, variable.description)}
                      {variable.type === "list" && renderListInput(variable.name, variable.description)}
                    </Field>
                  ))}
                </div>
              </div>
            )}
            {variablesInEnvironments && variablesInEnvironments.length > 0 && (
              <div className="mb-4">
                <div className="text-base font-bold mb-1">{t("Common.Environments")}</div>
                <div className="flex flex-col gap-2">
                  {variablesInEnvironments.map((variable) => (
                    <Field
                      label={variable.name}
                      validationMessage={errorMessages.config[variable.name]}
                      validationState={errorMessages.config[variable.name] ? "error" : "none"}
                      key={variable.name}
                    >
                      {renderStringInput("config", variable.name, variable.description)}
                    </Field>
                  ))}
                </div>
              </div>
            )}
            {variablesInHeaders && variablesInHeaders.length > 0 && (
              <div className="mb-4">
                <div className="text-base font-bold mb-1">{t("Common.RequestHeaders")}</div>
                <div className="flex flex-col gap-2">
                  {variablesInHeaders.map((variable) => (
                    <Field
                      label={variable.name}
                      validationMessage={errorMessages.config[variable.name]}
                      validationState={errorMessages.config[variable.name] ? "error" : "none"}
                      key={variable.name}
                    >
                      {renderStringInput("config", variable.name, variable.description)}
                    </Field>
                  ))}
                </div>
              </div>
            )}

            <div
              className="text-xs mt-4"
              // biome-ignore lint/security/noDangerouslySetInnerHtml: x
              dangerouslySetInnerHTML={{
                __html: render(`\`\`\`json\n${templatePreview}\n\`\`\``),
              }}
            />
          </DialogContent>
          <DialogActions>
            <DialogTrigger disableButtonEnhancement>
              <Button appearance="subtle" onClick={handleClose}>
                {t("Common.Cancel")}
              </Button>
            </DialogTrigger>
            <DialogTrigger disableButtonEnhancement>
              <Button appearance="primary" onClick={handleInstall}>
                {t("Common.Action.Install")}
              </Button>
            </DialogTrigger>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
});
