import { type JSX } from 'react';
import type { ConfigItemAutocomplete } from '../types';
import ConfigGeneric, { type ConfigGenericState, type ConfigGenericProps } from './ConfigGeneric';
export interface ConfigAutocompleteProps extends ConfigGenericProps {
    schema: ConfigItemAutocomplete;
}
export interface ConfigAutocompleteState extends ConfigGenericState {
    selectOptions: {
        value: string;
        label: string;
    }[];
}
declare class ConfigAutocomplete extends ConfigGeneric<ConfigAutocompleteProps, ConfigAutocompleteState> {
    componentDidMount(): void;
    renderItem(error: unknown, disabled: boolean): JSX.Element | null;
}
export default ConfigAutocomplete;
