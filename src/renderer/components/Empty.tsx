import { Image, Text } from '@fluentui/react-components';
import { t } from 'i18next';
import useAppearanceStore from 'stores/useAppearanceStore';
import { getImage } from 'renderer/components/Assets';

export default function Empty({
  image,
  text = '',
}: {
  image: string;
  text?: string;
}) {
  const theme = useAppearanceStore((state) => state.theme);
  const darkImg = getImage(image, 'dark');
  const lightImag = getImage(image, 'light');
  return (
    <div className="text-center flex flex-col items-start justify-center h-4/5 px-2">
      <picture className="mx-auto">
        <source
          srcSet={darkImg}
          media={theme === 'dark' ? 'all' : 'none'}
          className="mx-auto"
        />
        <Image
          src={lightImag}
          alt={t('Hint')}
          width={240}
          className="mx-auto"
        />
      </picture>
      <div className="text-center mx-auto mt-2 max-w-md">
        <Text size={300} className="text-color-secondary">
          {text}
        </Text>
      </div>
    </div>
  );
}
