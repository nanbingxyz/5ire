import {
  Dropdown,
  Input,
  Label,
  Option,
  Button,
  Tooltip,
  Switch,
  SwitchOnChangeData,
} from '@fluentui/react-components';
import { useTranslation } from 'react-i18next';
import { ChangeEvent, useCallback, useEffect, useMemo, useState } from 'react';
import useProvider from 'hooks/useProvider';
import { Info16Regular } from '@fluentui/react-icons';
import TooltipIcon from 'renderer/components/TooltipIcon';
import ToolStatusIndicator from 'renderer/components/ToolStatusIndicator';
import { isUndefined } from 'lodash';
import RemoteModelPicker from './RemoteModelPicker';
import { IChatModel } from '../../../providers/types';
import useSettingsStore from '../../../stores/useSettingsStore';

export default function ModelField() {
  const { t } = useTranslation();
  const { getProvider } = useProvider();
  const providerName = useSettingsStore((state) => state.api.provider);
  const model = useSettingsStore((state) => state.api.model);
  const provider = getProvider(providerName);
  const { getChatModels } = useProvider();
  const { setAPI, setToolState, getToolState, toolStates } = useSettingsStore();
  const { getDefaultChatModel } = useProvider();
  const [toolEnabled, setToolEnabled] = useState(
    getToolState(provider.name, model) || false,
  );

  const models = useMemo(() => {
    return getChatModels(provider.name);
  }, [provider]);

  const curModelLabel = useMemo(() => {
    return models.find((m) => m.name === model)?.label || '';
  }, [model, models]);

  useEffect(() => {
    if (provider) {
      const defaultModel = getDefaultChatModel(provider.name).name || '';
      setAPI({
        model: model || defaultModel,
      });
    }
  }, [provider]);

  useEffect(() => {
    if (provider && model) {
      let newToolEnabled = getToolState(provider.name, model);
      if (isUndefined(newToolEnabled)) {
        const curModel = models.find((m) => m.name === model);
        newToolEnabled = curModel?.toolEnabled || false;
      }
      setToolEnabled(newToolEnabled);
    }
  }, [provider, model, toolStates]);

  const onOptionSelect = (ev: any, data: any) => {
    setAPI({ model: data.optionValue });
  };

  const onInput = (evt: any) => {
    setAPI({ model: evt.target.value });
  };

  const setModel = (_model: string) => {
    setAPI({ model: _model });
  };

  const setToolSetting = (
    _: ChangeEvent<HTMLInputElement>,
    data: SwitchOnChangeData,
  ) => {
    setToolState(provider.name, model, data.checked);
  };

  const renderRemoteModelPicker = useCallback(() => {
    return provider.options.modelsEndpoint ? (
      <div className="absolute right-1 top-1">
        <RemoteModelPicker provider={provider} onConfirm={setModel} />
      </div>
    ) : null;
  }, [provider]);

  return (
    <div className="flex justify-start items-center my-3.5 gap-1">
      <div className="w-80">
        <div className="flex justify-start items-center mb-1.5 w-full">
          <Label htmlFor="model">{t('Common.Model')}</Label>
          <TooltipIcon tip={t(provider.chat.docs?.model || '')} />
        </div>
        <div className="w-full">
          {models.length > 0 ? (
            models.length === 1 ? (
              <div className="flex flex-row justify-start items-center gap-1 w-full">
                <ToolStatusIndicator
                  provider={provider.name}
                  model={models[0].name}
                  withTooltip
                />
                <span className="latin">{models[0].label}</span>
                {models[0].description && (
                  <Tooltip
                    content={models[0].description as string}
                    relationship="label"
                  >
                    <Button
                      icon={<Info16Regular />}
                      size="small"
                      appearance="subtle"
                    />
                  </Tooltip>
                )}
              </div>
            ) : (
              <Dropdown
                aria-labelledby="model"
                className="w-full"
                value={curModelLabel}
                selectedOptions={[model]}
                onOptionSelect={onOptionSelect}
              >
                {models.map((model: IChatModel) => (
                  <Option
                    key={model.name as string}
                    text={model.label as string}
                    value={model.name as string}
                  >
                    <div className="flex justify-start items-center latin">
                      <div className="flex justify-start items-baseline gap-1">
                        <ToolStatusIndicator
                          model={model.name}
                          provider={provider.name}
                        />
                        <span className="latin">{model.label as string}</span>
                      </div>
                      {model.description && (
                        <Tooltip
                          content={model.description as string}
                          relationship="label"
                        >
                          <Button
                            icon={<Info16Regular />}
                            size="small"
                            appearance="subtle"
                          />
                        </Tooltip>
                      )}
                    </div>
                  </Option>
                ))}
              </Dropdown>
            )
          ) : (
            <div className="flex flex-grow justify-start items-center gap-1 relative">
              {provider.chat.options.modelCustomizable && (
                <Input
                  value={model || ''}
                  placeholder={t(
                    provider.chat.placeholders?.deploymentId || '',
                  )}
                  onInput={onInput}
                  className="w-full"
                />
              )}

              {renderRemoteModelPicker()}
            </div>
          )}
        </div>
      </div>
      <div>
        <div className="flex justify-start items-center">
          <Label>{t('Common.Tools')}</Label>
          <TooltipIcon tip={t('Common.SupportToolsTip')} />
        </div>
        <div className="flex justify-start items-center gap-1 -mb-1.5">
          <Switch checked={toolEnabled} onChange={setToolSetting} />
        </div>
      </div>
    </div>
  );
}
