import { type JSX } from 'react';
import type { ConfigItemAutocompleteSendTo } from '../types';
import ConfigGeneric, { type ConfigGenericProps } from './ConfigGeneric';
import type { ConfigAutocompleteState } from './ConfigAutocomplete';
interface ConfigAutocompleteSendToProps extends ConfigGenericProps {
    schema: ConfigItemAutocompleteSendTo;
}
interface ConfigAutocompleteSendToState extends ConfigAutocompleteState {
    loading?: boolean;
}
declare class ConfigAutocompleteSendTo extends ConfigGeneric<ConfigAutocompleteSendToProps, ConfigAutocompleteSendToState> {
    private initialized;
    private localContext;
    askInstance(): void;
    getContext(): string;
    renderItem(error: unknown, disabled: boolean): JSX.Element | null;
}
export default ConfigAutocompleteSendTo;
