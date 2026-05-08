import { type JSX } from 'react';
import type { ConfigItemObjectId } from '../types';
import ConfigGeneric, { type ConfigGenericProps, type ConfigGenericState } from './ConfigGeneric';
interface ConfigObjectIdProps extends ConfigGenericProps {
    schema: ConfigItemObjectId;
}
interface ConfigObjectIdState extends ConfigGenericState {
    showSelectId?: boolean;
    initialized?: boolean;
}
declare class ConfigObjectId extends ConfigGeneric<ConfigObjectIdProps, ConfigObjectIdState> {
    componentDidMount(): void;
    renderItem(error: string, disabled: boolean): JSX.Element;
}
export default ConfigObjectId;
