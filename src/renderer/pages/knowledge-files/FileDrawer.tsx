import {
  Drawer,
  DrawerHeader,
  DrawerHeaderTitle,
  Button,
  DrawerBody,
  Divider,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  DialogTrigger,
} from '@fluentui/react-components';
import {
  CheckmarkCircle16Filled,
  Delete16Regular,
  Dismiss24Regular,
  DocumentArrowRight20Regular,
} from '@fluentui/react-icons';
import { useTranslation } from 'react-i18next';
import { useEffect, useMemo, useState } from 'react';
import useToast from 'hooks/useToast';
import { typeid } from 'typeid-js';
import useKnowledgeStore from 'stores/useKnowledgeStore';
import useAppearanceStore from 'stores/useAppearanceStore';
import { ICollectionFile } from 'types/knowledge';
import { fileSize, paddingZero } from 'utils/util';
import useNav from 'hooks/useNav';
import { captureException } from 'renderer/logging';

/**
 * Renders a drawer interface for managing files within a knowledge collection.
 * Displays file upload progress, existing files list, and handles file import/deletion operations.
 * Shows a dialog if the embedding model is not ready before allowing file additions.
 */
export default function FileDrawer({
  collection,
  open,
  setOpen,
}: {
  collection: any;
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const navigate = useNav();
  const { notifyError, notifySuccess } = useToast();
  const getPalette = useAppearanceStore((state) => state.getPalette);
  const { listFiles, deleteFile } = useKnowledgeStore();

  const [files, setFiles] = useState<File[]>([]);
  const [fileList, setFileList] = useState<ICollectionFile[]>([]);
  const [progresses, setProgresses] = useState<{ [key: string]: number }>({});
  const [fileStatus, setFileStatus] = useState<{ [key: string]: boolean }>({
    'model_quantized.onnx': false,
    'config.json': false,
    'tokenizer_config.json': false,
    'tokenizer.json': false,
  });

  const isEmbeddingModelReady = useMemo(() => {
    return Object.values(fileStatus).every((item) => item);
  }, [fileStatus]);

  useEffect(() => {
    window.electron.embeddings.getModelFileStatus().then((status: any) => {
      setFileStatus(status);
    }).catch((err) => {
      captureException(err);
    });
    setFiles([]);
    setProgresses({});
    window.electron.ipcRenderer.on(
      'knowledge-import-progress',
      (filePath: unknown, total: unknown, done: unknown) => {
        const percent = Math.ceil(((done as number) / (total as number)) * 100);
        setProgresses((prev) => ({
          ...prev,
          [filePath as string]: percent,
        }));
      },
    );

    listFiles(collection.id).then((curFiles: any[]) => {
      setFileList(curFiles);
    }).catch((err) => {
      captureException(err);
    });

    return () => {
      window.electron.ipcRenderer.unsubscribeAll('knowledge-import-progress');
    };
  }, [collection, open]);

  /**
   * Imports files into the collection by processing them in batches of 3.
   * Updates the files state and triggers the import process for each file with progress tracking.
   * Displays error notifications for any failed imports.
   */
  const importFiles = async (newFiles: File[]) => {
    setFiles(newFiles);
    const collectionId = collection.id;
    try {
      const batchSize = 3;
      for (let i = 0; i < newFiles.length; i += batchSize) {
        const batch = newFiles.slice(i, i + batchSize);
        await Promise.all(
          batch.map((file) =>
            window.electron.knowledge
              .importFile({
                file: {
                  id: typeid('kf').toString(),
                  name: file.name,
                  path: file.path,
                  size: file.size,
                  type: file.type,
                },
                collectionId,
              })
              .catch((err) => {
                captureException(err);
                notifyError(
                  t('Knowledge.Notification.ImportError', { name: file.name }),
                );
              }),
          ),
        );
      }
    } catch (error) {
      console.error('Import files failed:', error);
      notifyError(t('Knowledge.Notification.ImportError'));
    }
  };

  /**
   * Removes a file from the collection and updates the file list.
   * Displays success or error notifications based on the operation result.
   */
  const removeFile = async (fileId: string) => {
    const ok = await window.electron.knowledge.removeFile(fileId);
    if (!ok) {
      notifyError(t('Knowledge.Notification.FileNotDeleted'));
      return;
    }
    await deleteFile(fileId);
    notifySuccess(t('Knowledge.Notification.FileDeleted'));
    listFiles(collection.id).then((curFiles: any[]) => {
      setFileList(curFiles);
    });
  };

  return (
    <Drawer
      position="end"
      open={open}
      onOpenChange={(_, data) => setOpen(data.open)}
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
          {collection?.name}
        </DrawerHeaderTitle>
      </DrawerHeader>
      <DrawerBody className="mt-2.5 flex flex-col gap-2 relative overflow-x-hidden">
        <div>
          {files.map((file: File) => (
            <div
              key={file.path}
              className="flex justify-between items-center py-1"
            >
              <div className="flex justify-start items-center truncate">
                <DocumentArrowRight20Regular className="flex-shrink-0 text-gray-500" />
                <div className="truncate mr-5 ml-1">{file.name}</div>
              </div>
              <div className="w-7 flex-shrink-0">
                {progresses[file.path] >= 100 ? (
                  <CheckmarkCircle16Filled
                    style={{ color: getPalette('success') }}
                  />
                ) : (
                  <span>{progresses[file.path] || 0}%</span>
                )}
              </div>
            </div>
          ))}
        </div>
        {fileList.length > 0 && (
          <div>
            <Divider>{t('Knowledge.Divider.Files')}</Divider>
            {fileList.map((file: ICollectionFile, index: number) => (
              <div
                key={file.id}
                className="flex justify-between items-center py-1"
              >
                <div className="w-44 truncate">
                  <span className="mr-1 number text-gray-500">
                    {paddingZero(index + 1, 2)}.
                  </span>
                  <span>{file.name}</span>
                </div>
                <span className="number text-left">{fileSize(file.size)}</span>
                <Button
                  size="small"
                  icon={<Delete16Regular />}
                  appearance="subtle"
                  onClick={() => removeFile(file.id)}
                />
              </div>
            ))}
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 p-2.5">
          {isEmbeddingModelReady ? (
            <Button
              className="w-full"
              appearance="primary"
              onClick={() => {
                window.electron.knowledge.selectFiles().then((data: any) => {
                  importFiles(JSON.parse(data));
                }).catch((err) => {
                  captureException(err);
                });
              }}
            >
              {t('Knowledge.Action.AddFiles')}
            </Button>
          ) : (
            <Dialog>
              <DialogTrigger disableButtonEnhancement>
                <Button className="w-full" appearance="primary">
                  {t('Knowledge.Action.AddFiles')}
                </Button>
              </DialogTrigger>
              <DialogSurface>
                <DialogBody>
                  <DialogTitle>
                    {t(
                      'Knowledge.FileDrawer.DialogTitle.EmbeddingModelIsMissing',
                    )}
                  </DialogTitle>
                  <DialogContent>
                    <p>
                      {t(
                        'Knowledge.FileDrawer.DialogContent.EmbeddingModelIsRequired',
                      )}
                    </p>
                  </DialogContent>
                  <DialogActions>
                    <DialogTrigger disableButtonEnhancement>
                      <Button appearance="secondary">Close</Button>
                    </DialogTrigger>
                    <Button
                      appearance="primary"
                      onClick={() => navigate('/settings')}
                    >
                      Go Settings
                    </Button>
                  </DialogActions>
                </DialogBody>
              </DialogSurface>
            </Dialog>
          )}
        </div>
      </DrawerBody>
    </Drawer>
  );
}
