import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import useChatStore from 'stores/useChatStore';
import useNav from 'hooks/useNav';
import useToast from 'hooks/useToast';
import { TEMP_CHAT_ID } from 'consts';
import { IChat } from 'intellichat/types';

/**
 * Custom hook for managing chat deletion functionality with confirmation dialog
 * @returns {Object} Object containing deletion state and control functions
 * @returns {boolean} delConfirmDialogOpen - Whether the delete confirmation dialog is open
 * @returns {Function} setDelConfirmDialogOpen - Function to set the dialog open state
 * @returns {Function} showDeleteConfirmation - Function to show delete confirmation for a specific chat
 * @returns {Function} onDeleteChat - Function to execute chat deletion
 * @returns {Function} cancelDelete - Function to cancel the deletion process
 * @returns {IChat|null} chatToDelete - The chat object that is pending deletion
 */
export default function useDeleteChat() {
  const { t } = useTranslation();
  const { notifySuccess } = useToast();
  const navigate = useNav();
  const deleteChat = useChatStore((state) => state.deleteChat);
  const [delConfirmDialogOpen, setDelConfirmDialogOpen] =
    useState<boolean>(false);
  const [chatToDelete, setChatToDelete] = useState<IChat | null>(null);

  /**
   * Shows the delete confirmation dialog for a specific chat
   * @param {IChat} [chat] - The chat to delete. If not provided, will delete current chat
   */
  const showDeleteConfirmation = (chat?: IChat) => {
    setChatToDelete(chat || null);
    setDelConfirmDialogOpen(true);
  };

  /**
   * Executes the chat deletion process
   * Deletes the specified chat or current chat, navigates to temp chat, and shows success notification
   */
  const onDeleteChat = async () => {
    if (chatToDelete) {
      await deleteChat(chatToDelete.id);
    } else {
      await deleteChat();
    }
    navigate(`/chats/${TEMP_CHAT_ID}`);
    notifySuccess(t('Chat.Notification.Deleted'));
    setDelConfirmDialogOpen(false);
    setChatToDelete(null);
  };

  /**
   * Cancels the delete operation and closes the confirmation dialog
   */
  const cancelDelete = () => {
    setDelConfirmDialogOpen(false);
    setChatToDelete(null);
  };

  return {
    delConfirmDialogOpen,
    setDelConfirmDialogOpen,
    showDeleteConfirmation,
    onDeleteChat,
    cancelDelete,
    chatToDelete,
  };
}
