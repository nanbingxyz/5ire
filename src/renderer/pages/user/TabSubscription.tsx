import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useAuthStore from 'stores/useAuthStore';
import supabase from 'vendors/supa';
import useToast from 'hooks/useToast';
import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  DialogTrigger,
  Input,
  Skeleton,
  SkeletonItem,
} from '@fluentui/react-components';
import { fmtDateTime } from 'utils/util';
import { captureException } from '../../logging';

/**
 * Subscription management component that displays subscription status, usage quota, and order history.
 * Provides functionality to redeem subscription codes.
 */
export default function TabSubscription() {
  const { t } = useTranslation();
  const { notifyError, notifyInfo, notifySuccess } = useToast();
  const [loading, setLoading] = useState(true);
  const [redeemOpen, setRedeemOpen] = useState(false);
  const [redeeming, setRedeeming] = useState(false);
  const [redeemCode, setRedeemCode] = useState<string>('');
  const [subscription, setSubscription] = useState<any>();
  const [orders, setOrders] = useState<any[]>([]);
  const [usage, setUsage] = useState<string>('-');
  const user = useAuthStore((state) => state.user);

  /**
   * Determines if the user has an active subscription by comparing the deadline with today's date.
   */
  const isSubscribed = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return (
      subscription &&
      subscription.deadline &&
      new Date(subscription.deadline).getTime() >= today.getTime()
    );
  }, [subscription]);

  /**
   * Fetches the current usage data for the user from the external API.
   * Updates the usage state with the retrieved value or captures any errors.
   */
  const loadUsage = async (userId: string) => {
    try {
      const resp = await fetch('https://openai.5ireai.com/v1/usage', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userId}`,
        },
      });
      const data = await resp.json();
      setUsage(data.usage);
    } catch (error) {
      captureException(error as any);
    }
  };

  /**
   * Retrieves the user's order history from the database, sorted by creation date in descending order.
   * Displays an error notification if the query fails.
   */
  const loadOrders = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('id, num_of_month, currency, amount, created_at')
        .order('created_at', { ascending: false })
        .eq('user_id', userId);
      if (error) {
        notifyError(error.message);
      } else {
        setOrders(data);
      }
    } catch (error) {
      captureException(error as any);
    }
  };

  /**
   * Fetches the user's subscription details including quota and deadline from the database.
   * Displays an error notification if the query fails.
   */
  const loadSubscription = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('id, quota_per_day, deadline')
        .eq('id', userId)
        .maybeSingle();
      if (error) {
        notifyError(error.message);
      } else {
        setSubscription(data);
      }
    } catch (error) {
      captureException(error as any);
    }
  };

  /**
   * Processes a redeem code by attempting to associate it with the user's account.
   * Validates the code length, updates the coupon record in the database, and refreshes subscription data on success.
   * Shows appropriate notifications for validation errors, redemption failures, or success.
   */
  const onRedeem = useCallback(
    async (userId: string | undefined) => {
      if (!userId) {
        notifyError('User not found');
        return;
      }
      if (redeemCode.length !== 20) {
        notifyInfo(t('Subscription.Notification.InvalidRedeemCode'));
        return;
      }
      try {
        setRedeeming(true);
        const { data, error } = await supabase
          .from('coupons')
          .update({
            user_id: userId,
          })
          .eq('id', redeemCode)
          .is('user_id', null)
          .is('redeemed_at', null)
          .select('id')
          .maybeSingle();
        if (error || !data) {
          notifyError(
            error?.message || t('Subscription.Notification.RedeemFailed'),
          );
        } else {
          notifySuccess(t('Subscription.Notification.RedeemSuccess'));
          loadSubscription(userId);
          loadOrders(userId);
          setRedeemOpen(false);
        }
      } catch (error) {
        captureException(error as any);
      } finally {
        setRedeeming(false);
      }
    },
    [redeemCode],
  );

  /**
   * Loads subscription, orders, and usage data when the user is available.
   * Sets loading state appropriately and captures any errors that occur during data fetching.
   */
  useEffect(() => {
    if (!user) {
      return;
    }
    setLoading(true);
    Promise.all([
      loadSubscription(user.id),
      loadOrders(user.id),
      loadUsage(user.id),
    ])
      .then(() => setLoading(false))
      .catch((err) => {
        setLoading(false);
        captureException(err);
      });
  }, [user]);

  /**
   * Renders either a skeleton loading state or an empty orders message based on the loading state.
   */
  const emptyOrders = useCallback(() => {
    return loading ? (
      <Skeleton>
        {[0, 1, 2].map((item) => (
          <div key={item} className="grid grid-cols-3">
            <div>
              <span className="inline-block w-24">
                <SkeletonItem />
              </span>
            </div>
            <div className="flex justify-end mr-4">
              <SkeletonItem style={{ width: 98 }} />
            </div>
            <div className="flex justify-end">
              <SkeletonItem style={{ width: 168 }} />
            </div>
          </div>
        ))}
      </Skeleton>
    ) : (
      <div className="text-xs tips py-2">{t('Subscription.NoOrder')}</div>
    );
  }, [orders, loading]);

  return (
    <>
      <div className="flex flex-col gap-5 w-full min-h-96">
        <Skeleton>
          {loading || isSubscribed ? (
            <div className="flex justify-between items-start bg-brand-surface-2 p-3 rounded">
              <div className="flex justify-start items-start gap-4">
                <div className="border-r border-base pr-6">
                  <div className="text-xs mb-1 tips">
                    {t('Subscription.ExpiresOn')}
                  </div>
                  {loading ? (
                    <SkeletonItem />
                  ) : (
                    <div className="text-xl">{subscription.deadline}</div>
                  )}
                </div>
                <div>
                  <div className="text-xs pl-2">
                    <div className="text-xs mb-1 tips">
                      {t('Subscription.QuotaPerDay')}
                    </div>
                    {loading ? (
                      <SkeletonItem />
                    ) : (
                      <div className="text-xl">
                        {usage || '0'} /{' '}
                        {isSubscribed ? subscription.quota_per_day : '0'}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <Button
                appearance="primary"
                size="small"
                onClick={() => setRedeemOpen(true)}
              >
                {t('Subscription.Redeem')}
              </Button>
            </div>
          ) : (
            <div className="bg-brand-surface-2 p-3 rounded flex justify-between items-start flex-warp">
              <div>
                <div className="text-base flex justify-start items-start gap-2">
                  {t('Subscription.NoActive')}
                </div>
                <div className="text-xs mt-2">{t('Subscription.CIA')}</div>
              </div>
              <Button appearance="primary" onClick={() => setRedeemOpen(true)}>
                {t('Subscription.Redeem')}
              </Button>
            </div>
          )}
        </Skeleton>
        <div>
          <div className="text border-b border-base pb-2">
            {t('Common.Orders')}
          </div>
          <div className="flex flex-col gap-1 pt-2">
            {orders.length
              ? orders.map((order) => (
                  <div key={order.id} className="grid grid-cols-3">
                    <div>
                      <span className="inline-block w-3 number">
                        {order.num_of_month}
                      </span>
                      {t('Subscription.Month')}
                    </div>
                    <div className="text-right mr-4 number">
                      {order.amount / 100} {order.currency}
                    </div>
                    <div className="text-right min-w-28 number">
                      {fmtDateTime(new Date(order.created_at))}
                    </div>
                  </div>
                ))
              : emptyOrders()}
          </div>
        </div>
      </div>
      <Dialog
        modalType="non-modal"
        open={redeemOpen}
        onOpenChange={(open) => setRedeemOpen(!open)}
      >
        <DialogSurface aria-describedby={undefined}>
          <DialogBody>
            <DialogTitle>{t('Subscription.Redeem')}</DialogTitle>
            <DialogContent>
              <button
                type="button"
                className="underline p-0"
                onClick={() =>
                  window.electron.openExternal('https://5ire.app/redeem-code')
                }
              >
                {t('Subscription.HowToGetRedeemCode')}
              </button>
              <Input
                className="w-full my-4"
                onChange={(e) => setRedeemCode(e.currentTarget.value)}
                placeholder={t('Subscription.Placeholder.RedeemCode')}
              />
            </DialogContent>
            <DialogActions>
              <DialogTrigger disableButtonEnhancement>
                <Button
                  appearance="subtle"
                  onClick={() => setRedeemOpen(false)}
                >
                  {t('Common.Cancel')}
                </Button>
              </DialogTrigger>
              <Button
                type="submit"
                appearance="primary"
                disabled={redeeming}
                onClick={() => onRedeem(user?.id)}
              >
                {redeeming ? t('Common.Waiting') : t('Common.Submit')}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </>
  );
}
