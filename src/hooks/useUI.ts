import { WINDOWS_TITLE_BAR_HEIGHT } from 'consts';
import usePlatform from './usePlatform';

/**
 * Hook that provides UI utilities for calculating heights based on the current platform.
 * Adjusts heights to account for Windows title bar when not on Darwin (macOS).
 * 
 * @returns {Object} Object containing height calculation utilities
 * @returns {Function} returns.heightStyle - Function to generate CSS height strings
 * @returns {Function} returns.calcHeight - Function to calculate numeric heights
 */
export default function useUI() {
  const { isDarwin } = usePlatform();

  /**
   * Calculates height value accounting for platform-specific title bar.
   * On Darwin (macOS), returns the original height. On other platforms,
   * subtracts the Windows title bar height.
   * 
   * @param {number} height - The original height value
   * @returns {number} The adjusted height value
   */
  const calcHeight = (height: number): number => {
    if (isDarwin) {
      return height;
    }
    return height - WINDOWS_TITLE_BAR_HEIGHT;
  };

  /**
   * Generates CSS height string accounting for platform-specific title bar.
   * On Darwin (macOS), returns the height as-is or defaults to '100vh'.
   * On other platforms, adjusts for Windows title bar height.
   * 
   * @param {string | number} [height] - The height value (number in px or CSS string)
   * @returns {string} CSS height string with platform adjustments
   */
  const heightStyle = (height?: string | number): string => {
    if (isDarwin) {
      return height ? `${height}px` : '100vh';
    }
    const h = height || '100vh';
    if (typeof h === 'number') {
      return `${calcHeight(h)}px`;
    }
    return `calc(${h} - ${WINDOWS_TITLE_BAR_HEIGHT}px)`;
  };
  return {
    heightStyle,
    calcHeight,
  };
}
