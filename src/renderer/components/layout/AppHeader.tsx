import { useEffect, useState } from 'react';
import {
  Button,
  Popover,
  PopoverSurface,
  PopoverTrigger,
} from '@fluentui/react-components';
import Mousetrap from 'mousetrap';
import {
  PanelLeftText24Filled,
  PanelLeftText24Regular,
  Search24Filled,
  Search24Regular,
  Wifi124Filled,
  Wifi124Regular,
  WifiOff24Filled,
  WifiOff24Regular,
  bundleIcon,
} from '@fluentui/react-icons';
import useOnlineStatus from 'hooks/useOnlineStatus';
import { useTranslation } from 'react-i18next';
import useAppearanceStore from '../../../stores/useAppearanceStore';
import './AppHeader.scss';
import SearchDialog from '../SearchDialog';
import TrafficLights from '../TrafficLights';

const PanelLeftIcon = bundleIcon(PanelLeftText24Filled, PanelLeftText24Regular);
const SearchIcon = bundleIcon(Search24Filled, Search24Regular);
const OnlineIcon = bundleIcon(Wifi124Filled, Wifi124Regular);
const OfflineIcon = bundleIcon(WifiOff24Filled, WifiOff24Regular);

export default function AppHeader() {
  const collapsed = useAppearanceStore((state) => state.sidebar.collapsed);
  const toggleSidebarVisibility = useAppearanceStore(
    (state) => state.toggleSidebarVisibility,
  );
  const { t } = useTranslation();
  const [searchOpen, setSearchOpen] = useState<boolean>(false);

  const NetworkStatusIcon = useOnlineStatus() ? (
    <Popover withArrow size="small" closeOnScroll>
      <PopoverTrigger disableButtonEnhancement>
        <Button icon={<OnlineIcon />} appearance="transparent" />
      </PopoverTrigger>
      <PopoverSurface>
        <div> {t('Common.Online')}</div>
      </PopoverSurface>
    </Popover>
  ) : (
    <Popover withArrow size="small" closeOnScroll>
      <PopoverTrigger disableButtonEnhancement>
        <Button icon={<OfflineIcon />} appearance="transparent" />
      </PopoverTrigger>
      <PopoverSurface>
        <div> {t('Common.Offline')}</div>
      </PopoverSurface>
    </Popover>
  );

  useEffect(() => {
    Mousetrap.bind('mod+f', () => setSearchOpen(true));
    return () => {
      Mousetrap.unbind('mod+f');
    };
  }, []);

  return (
    <div>
      <div
        className={`app-header z-30 pl-20 pt-2.5 w-auto ${collapsed ? 'md:w-[10rem]' : 'md:w-[17rem]'
          } flex items-center`}
      >
        <TrafficLights />
        <div className="block md:hidden pl-1">
          <Button
            icon={<PanelLeftIcon />}
            appearance="transparent"
            onClick={() => toggleSidebarVisibility()}
          />
        </div>
        <div>
          <Button
            icon={<SearchIcon />}
            appearance="transparent"
            onClick={() => setSearchOpen(true)}
          />
        </div>
        <div>{NetworkStatusIcon}</div>
      </div>
      <SearchDialog open={searchOpen} setOpen={setSearchOpen} />
    </div>
  );
}
