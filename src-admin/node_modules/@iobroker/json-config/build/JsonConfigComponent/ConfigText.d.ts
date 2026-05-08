import { type JSX } from 'react';
import type { ConfigItemText } from '../types';
import ConfigGeneric, { type ConfigGenericProps, type ConfigGenericState } from './ConfigGeneric';
interface ConfigTextProps extends ConfigGenericProps {
    schema: ConfigItemText;
}
interface ConfigTextState extends ConfigGenericState {
    oldValue?: string;
    jsonError?: boolean;
}
declare class ConfigText extends ConfigGeneric<ConfigTextProps, ConfigTextState> {
    private updateTimeout;
    componentDidMount(): void;
    validateJson(value: string | null | undefined): boolean;
    static getDerivedStateFromProps(props: ConfigTextProps, state: ConfigTextState): Partial<ConfigTextState> | null;
    renderItem(error?: boolean, disabled?: boolean): JSX.Element;
}
export default ConfigText;
