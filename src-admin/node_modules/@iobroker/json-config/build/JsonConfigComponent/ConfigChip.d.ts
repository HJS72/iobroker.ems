import { type JSX } from 'react';
import type { ConfigItemChip } from '../types';
import ConfigGeneric, { type ConfigGenericProps, type ConfigGenericState } from './ConfigGeneric';
interface ConfigChipProps extends ConfigGenericProps {
    schema: ConfigItemChip;
}
declare class ConfigChip extends ConfigGeneric<ConfigChipProps, ConfigGenericState> {
    componentDidMount(): void;
    renderItem(error: string, disabled: boolean): JSX.Element | null;
}
export default ConfigChip;
