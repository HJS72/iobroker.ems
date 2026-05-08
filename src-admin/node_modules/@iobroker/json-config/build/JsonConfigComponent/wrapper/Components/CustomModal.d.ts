import { type JSX } from 'react';
interface CustomModalProps {
    toggleTranslation?: () => void;
    noTranslation?: boolean;
    title: string;
    fullWidth?: boolean;
    help?: string;
    maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | false;
    progress?: boolean;
    icon?: any;
    applyDisabled?: boolean;
    applyButton?: boolean;
    onClose: () => void;
    children: JSX.Element | JSX.Element[] | string | string[] | undefined | null;
    titleButtonApply?: string;
    titleButtonClose?: string;
    onApply: (value: string) => void;
    textInput?: boolean;
    defaultValue?: string;
    overflowHidden?: boolean;
}
declare const CustomModal: ({ toggleTranslation, noTranslation, title, fullWidth, help, maxWidth, progress, icon, applyDisabled, applyButton, onClose, children, titleButtonApply, titleButtonClose, onApply, textInput, defaultValue, overflowHidden, }: CustomModalProps) => JSX.Element;
export default CustomModal;
