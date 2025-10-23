import {
  Drawer,
  DrawerHeader,
  DrawerHeaderTitle,
  Button,
  DrawerBody,
  Field,
  Input,
  SpinButton,
  Switch,
  InfoLabel,
  SpinButtonChangeEvent,
  SpinButtonOnChangeData,
} from '@fluentui/react-components';
import { Dismiss24Regular } from '@fluentui/react-icons';
import { useTranslation } from 'react-i18next';
import {
  DEFAULT_CONTEXT_WINDOW,
  DEFAULT_MAX_TOKENS,
  MAX_CONTEXT_WINDOW,
  MAX_TOKENS,
} from 'consts';
import useToast from 'hooks/useToast';
import { isNil } from 'lodash';
import { IChatModelConfig, IChatProviderConfig } from 'providers/types';
import { useEffect, useMemo, useState } from 'react';
import useProviderStore from 'stores/useProviderStore';

/**
 * Renders a drawer form for creating or editing AI model configurations.
 * Manages form state for model properties including name, pricing, capabilities, and context settings.
 * Validates model names to prevent duplicates and handles save/delete operations through the provider store.
 */
export default function ModelFormDrawer({
  open,
  setOpen,
  model,
  models,
  onSaved,
}: {
  open: boolean;
  setOpen: (state: boolean) => void;
  model: IChatModelConfig | null;
  models: IChatModelConfig[];
  onSaved: () => void;
}) {
  const provider = useProviderStore(
    (state) => state.provider as IChatProviderConfig,
  );
  const { t } = useTranslation();
  const { notifySuccess } = useToast();
  const { createModel, updateModel, deleteModel } = useProviderStore();
  const [name, setName] = useState<string>('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [label, setLabel] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [contextWindow, setContextWindow] = useState<number>(
    DEFAULT_CONTEXT_WINDOW,
  );
  const [maxTokens, setMaxTokens] = useState<number>(DEFAULT_MAX_TOKENS);
  const [inputPrice, setInputPrice] = useState<number>(0);
  const [outputPrice, setOutputPrice] = useState<number>(0);
  const [vision, setVision] = useState<boolean>(false);
  const [tools, setTools] = useState<boolean>(false);
  const [isDefault, setIsDefault] = useState<boolean>(false);
  const [disabled, setDisabled] = useState<boolean>(false);
  const [extras, setExtras] = useState<{ [key: string]: string }>({});

  /** Computes the list of existing model names excluding the current model being edited */
  const modelNames = useMemo(() => {
    return models.map((m) => m.name).filter((n) => n !== model?.name);
  }, [models, model?.name]);

  /**
   * Formats a numeric price value with the appropriate currency symbol
   * @param value - The numeric price value to format
   * @returns The formatted price string with currency symbol
   */
  const formatter = (value: number) => {
    return `${provider.currency === 'USD' ? '$' : '¥'}${value}`;
  };

  /**
   * Parses a formatted currency string back to a numeric value
   * @param formattedValue - The formatted currency string to parse
   * @returns The parsed numeric value or NaN if parsing fails
   */
  const parser = (formattedValue: string | null) => {
    if (formattedValue === null) {
      return NaN;
    }

    return parseFloat(formattedValue.replace(/[$¥]/g, ''));
  };

  /**
   * Creates a change handler for SpinButton components that updates the provided state setter.
   * Handles both direct value changes and display value parsing.
   * @param setValue - State setter function to update with the new value
   * @returns Event handler function for SpinButton onChange events
   */
  const onSpinButtonChange = (setValue: (value: number) => void) => {
    /**
     * Handles SpinButton change events by extracting and validating the new value
     * @param _ev - The change event (unused)
     * @param data - The change data containing the new value or display value
     */
    return (_ev: SpinButtonChangeEvent, data: SpinButtonOnChangeData) => {
      if (data.value !== undefined) {
        setValue(data.value as number);
      } else if (data.displayValue !== undefined) {
        const newValue = parser(data.displayValue);
        if (!Number.isNaN(newValue)) {
          setValue(newValue);
        } else {
          console.error(`Cannot parse "${data.displayValue}" as a number.`);
        }
      }
    };
  };

  /** Resets all form fields to their default values and clears validation errors */
  const reset = () => {
    setName('');
    setLabel('');
    setDescription('');
    setContextWindow(DEFAULT_CONTEXT_WINDOW);
    setMaxTokens(MAX_TOKENS);
    setInputPrice(0);
    setOutputPrice(0);
    setVision(false);
    setTools(false);
    setIsDefault(false);
    setDisabled(false);
    setExtras({});
    setNameError(null);
  };

  /**
   * Validates the form and saves the model configuration.
   * Checks for required name field and duplicate names, then either creates a new model or updates the existing one.
   * Capabilities are conditionally enabled based on provider settings and model type.
   */
  const onSave = () => {
    let currentNameError = '';
    if (name.trim() === '') {
      currentNameError = t('Common.Required');
      setNameError(currentNameError);
    } else if (modelNames.includes(name.trim())) {
      currentNameError = t('Provider.Model.NameAlreadyExists');
      setNameError(currentNameError);
    } else {
      setNameError('');
    }
    if (currentNameError) {
      return;
    }
    const payload = {
      id: model?.id || '',
      name,
      label,
      description,
      contextWindow,
      maxTokens,
      inputPrice,
      outputPrice,
      isDefault,
      disabled,
      isReady: true,
      extras,
      capabilities: {
        tools: (!!provider.modelsEndpoint ||
          !model?.isBuiltIn ||
          model?.capabilities?.tools) && {
          enabled: tools,
        },
        vision: (!!provider.modelsEndpoint ||
          !model?.isBuiltIn ||
          model?.capabilities?.vision) && {
          enabled: vision,
        },
      },
    };
    if (model) {
      updateModel(payload);
    } else {
      createModel(payload);
    }
    onSaved();
    setOpen(false);
    setTimeout(() => reset(), 500);
  };

  /**
   * Deletes the current model from the provider store.
   * Closes the drawer, resets the form, and displays a success notification.
   */
  const onDelete = () => {
    if (model) {
      deleteModel(model.id as string);
      setOpen(false);
      reset();
      notifySuccess(
        `${t('Provider.Model.Deleted', { model: model?.label || model?.name })}`,
      );
    }
  };

  useEffect(() => {
    // Reset the form on close
    if (model && open) {
      setName(model.name);
      setLabel(model.label || '');
      setDescription(model.description || '');
      setContextWindow(model.contextWindow || DEFAULT_CONTEXT_WINDOW);
      setMaxTokens(model.maxTokens || DEFAULT_MAX_TOKENS);
      setIsDefault(model.isDefault || false);
      setDisabled(model.disabled || false);
      setInputPrice(model.inputPrice || 0);
      setOutputPrice(model.outputPrice || 0);
      setVision(model.capabilities?.vision?.enabled || false);
      setTools(model.capabilities?.tools?.enabled || false);
      setExtras(model.extras || {});
      setNameError(null);
    } else {
      reset();
    }
  }, [model, open]);

  /**
   * Renders the delete button section.
   * Shows a disabled message for built-in models or an active delete button for custom models.
   */
  const deleteButton = () => {
    if (!model) return null;
    return model.isBuiltIn ? (
      <div className="my-2 border border-zinc-300 dark:border-zinc-600 rounded p-1 text-center text-small text-zinc-400 dark:text-zinc-500">
        {t('Provider.Model.BuiltInModelCannotBeDeleted')}
      </div>
    ) : (
      <div className="my-2 border border-red-400 dark:border-red-800 rounded p-1">
        <Button
          size="small"
          appearance="subtle"
          className="w-full text-red-00 dark:text-red-400"
          onClick={onDelete}
        >
          {t('Common.Delete')}
        </Button>
      </div>
    );
  };

  return (
    <Drawer
      separator
      open={open}
      onOpenChange={(_, data) => setOpen(data.open)}
      position="end"
    >
      <DrawerHeader>
        <DrawerHeaderTitle
          action={
            <Button
              appearance="subtle"
              aria-label="Close"
              icon={<Dismiss24Regular />}
              onClick={() => setOpen(false)}
            />
          }
        >
          {model ? t('Provider.Model.Edit') : t('Provider.Model.New')}
        </DrawerHeaderTitle>
      </DrawerHeader>

      <DrawerBody className="flex flex-col gap-4">
        <Field
          size="small"
          validationMessage={nameError}
          validationState={nameError ? 'error' : undefined}
        >
          <InfoLabel
            size="small"
            info={
              model?.isFromApi
                ? t('Provider.Model.ApiModelNameCannotBeChanged')
                : ''
            }
          >
            {t('Provider.Model.Name')}
          </InfoLabel>
          <Input
            disabled={model?.isFromApi}
            placeholder={t('Common.Required')}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (modelNames.includes(e.target.value)) {
                setNameError(t('Provider.Model.NameAlreadyExists'));
              } else {
                setNameError(null);
              }
            }}
          />
        </Field>
        <Field label={t('Provider.Model.DisplayName')} size="small">
          <Input value={label} onChange={(e) => setLabel(e.target.value)} />
        </Field>
        <Field label={t('Common.Description')} size="small">
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
        <div className="flex justify-evenly items-center gap-1">
          <Field label={t('Provider.Model.ContextWindow')} size="small">
            <SpinButton
              placeholder={t('Common.Required')}
              min={0}
              step={1}
              max={MAX_CONTEXT_WINDOW}
              value={contextWindow}
              onChange={onSpinButtonChange(setContextWindow)}
              size="small"
            />
          </Field>
          <Field label={t('Common.MaxTokens')} size="small">
            <SpinButton
              value={maxTokens}
              min={0}
              step={1}
              max={MAX_TOKENS}
              onChange={onSpinButtonChange(setMaxTokens)}
              size="small"
            />
          </Field>
        </div>
        <div className="flex justify-evenly items-center gap-1">
          <Field size="small">
            <InfoLabel size="small" info={t('Provider.Model.PriceUnit')}>
              {t('Common.InputPrice')}{' '}
            </InfoLabel>
            <SpinButton
              value={inputPrice}
              min={0}
              step={0.000001}
              max={999}
              size="small"
              displayValue={formatter(inputPrice)}
              onChange={onSpinButtonChange(setInputPrice)}
            />
          </Field>
          <Field size="small">
            <InfoLabel size="small" info={t('Provider.Model.PriceUnit')}>
              {t('Common.OutputPrice')}{' '}
            </InfoLabel>
            <SpinButton
              value={outputPrice}
              min={0}
              step={0.000001}
              max={999}
              size="small"
              displayValue={formatter(outputPrice)}
              onChange={onSpinButtonChange(setOutputPrice)}
            />
          </Field>
        </div>
        {provider.modelExtras?.map((extraName: string) => {
          return (
            <Field
              key={extraName}
              label={t(`Dynamic.${extraName}`)}
              size="small"
            >
              <Input
                value={extras[extraName] || ''}
                placeholder={t('Common.Required')}
                onChange={(e) => {
                  setExtras({
                    ...extras,
                    [extraName]: e.target.value,
                  });
                }}
              />
            </Field>
          );
        })}
        <div className="grid grid-cols-2 gap-1 field-small">
          <Switch
            disabled={
              !provider.modelsEndpoint && model
                ? isNil(model?.capabilities?.vision)
                : false
            }
            label={t('Provider.Model.Vision')}
            className="-ml-1.5"
            checked={vision}
            onChange={(_, data) => setVision(data.checked)}
          />
          <Switch
            disabled={
              !provider.modelsEndpoint && model
                ? isNil(model?.capabilities?.tools)
                : false
            }
            label={t('Provider.Model.Tools')}
            className="-ml-1.5"
            checked={tools}
            onChange={(_, data) => setTools(data.checked)}
          />
        </div>
        <div className="grid grid-cols-2 gap-1 field-small">
          <Switch
            label={t('Common.Default')}
            className="-ml-1.5 -mt-2 field-small"
            checked={isDefault}
            onChange={(_, data) => setIsDefault(data.checked)}
          />
          <Switch
            label={t('Common.Enabled')}
            className="-ml-1.5 -mt-2 field-small"
            checked={!disabled}
            onChange={(_, data) => setDisabled(!data.checked)}
          />
        </div>
        <div className="py-2">
          <Button appearance="primary" className="w-full" onClick={onSave}>
            {t('Common.Save')}
          </Button>
        </div>
        <div className="flex-grow" />
        {deleteButton()}
      </DrawerBody>
    </Drawer>
  );
}
