import { type JSX } from 'react';
import type { ConfigItemUser } from '../types';
import ConfigGeneric, { type ConfigGenericProps, type ConfigGenericState } from './ConfigGeneric';
interface ConfigUserProps extends ConfigGenericProps {
    schema: ConfigItemUser;
}
interface ConfigUserState extends ConfigGenericState {
    users: Record<string, {
        color?: string;
        icon?: string;
        name: string;
    }>;
}
declare class ConfigUser extends ConfigGeneric<ConfigUserProps, ConfigUserState> {
    componentDidMount(): void;
    renderItem(error: string, disabled: boolean): JSX.Element;
}
export default ConfigUser;
