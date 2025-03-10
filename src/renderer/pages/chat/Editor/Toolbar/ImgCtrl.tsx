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
  InputOnChangeData,
  Radio,
  RadioGroup,
} from '@fluentui/react-components';
import Mousetrap from 'mousetrap';
import {
  bundleIcon,
  ImageAdd20Regular,
  ImageAdd20Filled,
  Dismiss24Regular,
  LinkSquare20Regular,
} from '@fluentui/react-icons';

import { IChat, IChatContext } from 'intellichat/types';
import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { isBlank } from 'utils/validators';
import { isWebUri } from 'valid-url';
import { insertAtCursor } from 'utils/util';
import { IChatModelVision } from 'providers/types';
import useChatStore from 'stores/useChatStore';

const ImageAddIcon = bundleIcon(ImageAdd20Filled, ImageAdd20Regular);

/**
 * ImgCtrl component
 * 
 * This component provides a button and dialog for adding images to the chat.
 * It only renders when the selected model has vision capabilities enabled.
 */
export default function ImgCtrl({
  ctx,
  chat,
}: {
  ctx: IChatContext;
  chat: IChat;
}) {
  const editStage = useChatStore((state) => state.editStage);
  const { t } = useTranslation();

  const [imgType, setImgType] = useState<'url' | 'file'>('url');
  const [imgURL, setImgURL] = useState<string>('');
  const [imgName, setImgName] = useState<string>('');
  const [imgBase64, setImgBase64] = useState<string>('');
  // true for <embed> tag, false for <img> tag
  const [useEmbed, setUseEmbed] = useState<boolean>(false);
  const [errMsg, setErrMsg] = useState<string>('');
  const [open, setOpen] = useState<boolean>(false);
  const model = ctx.getModel();

  const openDialog = () => {
    setOpen(true);
    setTimeout(
      () =>
        document
          .querySelector<HTMLInputElement>(
            imgType === 'url' ? '#image-url-input' : '#select-file-button'
          )
          ?.focus(),
      500
    );
    Mousetrap.bind('esc', closeDialog);
  };

  const closeDialog = () => {
    setOpen(false);
    Mousetrap.unbind('esc');
  };

  // Make sure vision capabilities are properly detected when model changes
  const vision = useMemo<IChatModelVision>(() => {
    return model?.vision || { enabled: false };
  }, [model, chat]); // Add chat as a dependency to ensure updates when chat changes

  useEffect(() => {
    Mousetrap.bind('mod+shift+7', openDialog);
    if (vision.enabled) {
      setImgType(vision.allowUrl ? 'url' : 'file');
    }
    return () => {
      Mousetrap.unbind('mod+shift+7');
    };
  }, [vision]);

  const isAddBtnDisabled = useMemo(() => {
    return isBlank(imgURL) && isBlank(imgBase64);
  }, [imgURL, imgBase64]);

  const onImageUrlChange = (
    ev: ChangeEvent<HTMLInputElement>,
    data: InputOnChangeData
  ) => {
    setImgURL(data.value);
  };

  const Add = () => {
    let url = null;
    if (imgURL) {
      if (!isWebUri(imgURL) && !imgURL.startsWith('data:')) {
        setErrMsg(t('Please input a valid image URL or base64 string.'));
        return;
      }
      url = imgURL;
    } else if (imgBase64) {
      url = imgBase64;
    }
    setErrMsg('');
    const editor = document.querySelector('#editor') as HTMLDivElement;
    editStage(chat.id, {
      input: insertAtCursor(
        editor,
        useEmbed ? `<iframe src="${url}" style="width:100%; height:500px; display:block; border:1px solid #ccc; border-radius:4px;" sandbox="allow-same-origin" frameborder="0"></iframe>` : `<img src="${url}" style="width:260px; display:block;" />`
      ),
    });
    setOpen(false);
    setImgURL('');
    setImgBase64('');
    setImgName('');
    editor.focus();
  };

  const renderImgUrlInput = () => {
    return (
      <Input
        value={imgURL}
        type="url"
        contentBefore={<LinkSquare20Regular />}
        id="image-url-input"
        className="w-full"
        onChange={onImageUrlChange}
      />
    );
  };

  const renderImgFileInput = () => {
    return (
      <div className="flex justify-start items-start gap-2">
        <Button
          className="file-button"
          id="select-file-button"
          onClick={async () => {
            const dataString = await window.electron.selectImageWithBase64();
            const file = JSON.parse(dataString);
            if (file.name && file.base64) {
              setImgName(file.name);
              setImgBase64(file.base64);
              setUseEmbed(file.useEmbed);
            }
          }}
        >
          {t('Common.SelectFile')}
        </Button>
        <div className="mt-1 text-base">{imgName}</div>
      </div>
    );
  };

  return vision.enabled ? (
    <Dialog open={open}>
      <DialogTrigger disableButtonEnhancement>
        <Button
          aria-label={t('Common.Image')}
          title="Mod+Shift+6"
          size="small"
          appearance="subtle"
          iconPosition="before"
          style={{ boxShadow: 'none', borderColor: 'transparent' }}
          className="justify-start text-color-secondary"
          onClick={openDialog}
          icon={<ImageAddIcon />}
        ></Button>
      </DialogTrigger>
      <DialogSurface aria-labelledby="add image">
        <DialogBody>
          <DialogTitle
            action={
              <DialogTrigger action="close">
                <Button
                  appearance="subtle"
                  aria-label="close"
                  onClick={closeDialog}
                  icon={<Dismiss24Regular />}
                />
              </DialogTrigger>
            }
          >
            {t('Editor.Toolbar.AddImage')}
          </DialogTitle>
          <DialogContent>
            <div className="w-full mb-5">
              <Field>
                <RadioGroup
                  layout="horizontal"
                  value={imgType}
                  onChange={(_, data: any) => setImgType(data.value)}
                >
                  <Radio value="url" label="URL" />
                  <Radio value="file" label="File" />
                </RadioGroup>
              </Field>

              <div style={{ height: '50px' }}>
                <Field className="mt-2">
                  {imgType === 'url'
                    ? renderImgUrlInput()
                    : renderImgFileInput()}
                  {errMsg ? (
                    <div className="mt-2 text-sm pl-1">{errMsg}</div>
                  ) : null}
                </Field>
              </div>
            </div>
          </DialogContent>
          <DialogActions>
            <DialogTrigger disableButtonEnhancement>
              <Button
                appearance="subtle"
                onClick={() => {
                  setOpen(false);
                  setImgURL('');
                  setImgBase64('');
                  setImgName('');
                  setErrMsg('');
                }}
              >
                {t('Common.Cancel')}
              </Button>
            </DialogTrigger>
            <Button
              appearance="primary"
              disabled={isAddBtnDisabled}
              onClick={Add}
            >
              {t('Add')}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  ) : null;
}
