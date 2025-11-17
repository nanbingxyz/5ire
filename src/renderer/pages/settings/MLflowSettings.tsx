import { useState, useEffect, FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Switch,
  Input,
  Button,
  Label,
  Field,
  makeStyles,
  tokens,
  Toast,
  ToastTitle,
  ToastBody,
  Toaster,
  useToastController,
  useId,
} from '@fluentui/react-components';
import { captureException } from '../../logging';

const useStyles = makeStyles({
  field: {
    marginBottom: tokens.spacingVerticalM,
  },
  input: {
    width: '100%',
  },
  saveButton: {
    marginTop: tokens.spacingVerticalM,
  },
});

interface MLflowConfig {
  enabled: boolean;
  trackingUri: string;
  experimentId: string;
  experimentName?: string;
}

/**
 * MLflow settings component for configuring MLflow tracing integration.
 * Allows users to enable/disable MLflow tracing and configure tracking URI and experiment ID.
 */
export default function MLflowSettings() {
  const { t } = useTranslation();
  const styles = useStyles();
  const toasterId = useId('mlflow-toaster');
  const { dispatchToast } = useToastController(toasterId);

  const [config, setConfig] = useState<MLflowConfig>({
    enabled: false,
    trackingUri: '',
    experimentId: '',
    experimentName: '',
  });

  const [isSaving, setIsSaving] = useState(false);

  // Load MLflow configuration on component mount
  useEffect(() => {
    window.electron.mlflow
      .getConfig()
      .then((mlflowConfig) => {
        setConfig(mlflowConfig);
      })
      .catch((error) => {
        captureException(error);
        console.error('Failed to load MLflow configuration:', error);
      });
  }, []);

  const handleEnabledChange = (_: FormEvent<HTMLInputElement>, data: any) => {
    setConfig({ ...config, enabled: data.checked });
  };

  const handleTrackingUriChange = (_: FormEvent<HTMLInputElement>, data: any) => {
    setConfig({ ...config, trackingUri: data.value });
  };

  const handleExperimentIdChange = (_: FormEvent<HTMLInputElement>, data: any) => {
    setConfig({ ...config, experimentId: data.value });
  };

  const handleExperimentNameChange = (_: FormEvent<HTMLInputElement>, data: any) => {
    setConfig({ ...config, experimentName: data.value });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await window.electron.mlflow.setConfig(config);
      dispatchToast(
        <Toast>
          <ToastTitle>MLflow configuration saved successfully</ToastTitle>
          <ToastBody>
            {config.enabled
              ? 'MLflow tracing is now enabled. All LLM requests will be traced.'
              : 'MLflow tracing has been disabled.'}
          </ToastBody>
        </Toast>,
        { intent: 'success' }
      );
    } catch (error) {
      captureException(error);
      console.error('Failed to save MLflow configuration:', error);
      dispatchToast(
        <Toast>
          <ToastTitle>Failed to save MLflow configuration</ToastTitle>
          <ToastBody>
            {error instanceof Error ? error.message : 'An unknown error occurred'}
          </ToastBody>
        </Toast>,
        { intent: 'error' }
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="settings-section">
      <Toaster toasterId={toasterId} />
      <div className="settings-section--header">MLflow Tracing</div>
      <div className="py-4 flex-grow">
        <p className="tips pb-4">
          MLflow tracing automatically captures LLM requests, responses, token usage,
          latency, and errors. Configure your MLflow tracking server details below.
        </p>

        <Field className={styles.field}>
          <Switch
            checked={config.enabled}
            onChange={handleEnabledChange}
            label="Enable MLflow Tracing"
          />
        </Field>

        {config.enabled && (
          <>
            <Field
              className={styles.field}
              label="Tracking URI"
              required
              hint="The URI of your MLflow tracking server (e.g., http://localhost:5000)"
            >
              <Input
                className={styles.input}
                value={config.trackingUri}
                onChange={handleTrackingUriChange}
                placeholder="http://localhost:5000"
                type="url"
              />
            </Field>

            <Field
              className={styles.field}
              label="Experiment ID"
              required
              hint="The MLflow experiment ID where traces will be logged"
            >
              <Input
                className={styles.input}
                value={config.experimentId}
                onChange={handleExperimentIdChange}
                placeholder="0"
              />
            </Field>

            <Field
              className={styles.field}
              label="Experiment Name (Optional)"
              hint="A friendly name for your experiment"
            >
              <Input
                className={styles.input}
                value={config.experimentName || ''}
                onChange={handleExperimentNameChange}
                placeholder="My AI Assistant Experiment"
              />
            </Field>

            <Button
              appearance="primary"
              onClick={handleSave}
              disabled={isSaving || !config.trackingUri || !config.experimentId}
              className={styles.saveButton}
            >
              {isSaving ? 'Saving...' : 'Save Configuration'}
            </Button>
          </>
        )}

        {!config.enabled && (
          <Button
            appearance="primary"
            onClick={handleSave}
            disabled={isSaving}
            className={styles.saveButton}
          >
            Save
          </Button>
        )}

        <div className="mt-6 p-4 bg-gray-100 dark:bg-gray-800 rounded">
          <h3 className="font-semibold mb-2">Getting Started with MLflow</h3>
          <ol className="list-decimal list-inside space-y-2 text-sm">
            <li>
              Install MLflow: <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">pip install mlflow</code>
            </li>
            <li>
              Start MLflow server: <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">mlflow ui --backend-store-uri sqlite:///mlflow.db --port 5000</code>
            </li>
            <li>
              Create an experiment in the MLflow UI at{' '}
              <a href="http://localhost:5000" target="_blank" rel="noopener noreferrer" className="underline">
                http://localhost:5000
              </a>
            </li>
            <li>Copy the experiment ID and paste it above</li>
            <li>Enable tracing and save the configuration</li>
          </ol>
          <p className="mt-3 text-sm">
            Learn more:{' '}
            <a
              href="https://mlflow.org/docs/latest/genai/tracing/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              MLflow Tracing Documentation
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
