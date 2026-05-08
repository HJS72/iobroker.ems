import { type JSX } from 'react';
import type { ConfigItemCheckLicense } from '../types';
import ConfigGeneric, { type ConfigGenericProps, type ConfigGenericState } from './ConfigGeneric';
export interface License {
    id: string;
    product: string;
    time: number;
    uuid: string;
    validTill: string;
    version: string;
    usedBy: string;
    invoice: string;
    json: string;
}
interface LicenseResult {
    id: string;
    validName: boolean;
    validUuid: boolean;
    validVersion: boolean;
    validTill: boolean;
    license: License;
    used?: boolean;
}
interface ConfigCheckLicenseProps extends ConfigGenericProps {
    schema: ConfigItemCheckLicense;
    fullWidth?: boolean;
}
interface ConfigCheckLicenseState extends ConfigGenericState {
    showLicenseData: null | Record<string, any>;
    _error: string;
    result: null | boolean;
    running: boolean;
    foundSuitableLicense: boolean;
    licenseOfflineCheck: boolean;
    showLinkToProfile: boolean;
    allLicenses: null | LicenseResult[];
    askForUpdate: boolean;
}
declare class ConfigCheckLicense extends ConfigGeneric<ConfigCheckLicenseProps, ConfigCheckLicenseState> {
    componentDidMount(): void;
    renderErrorDialog(): JSX.Element | null;
    renderMessageDialog(): JSX.Element | null;
    static parseJwt(token: string): {
        exp: number;
        iat: number;
        name: string;
        email: string;
        uuid: string;
        version: string;
        invoice: string;
        /** @deprecated use validTill */
        valid_till: string;
        validTill: string;
        [key: string]: string | number;
    } | null;
    static isVersionValid(version: string, rule: string, invoice: string, adapterName: string): boolean;
    findInLicenseManager(adapterName: string): Promise<LicenseResult[]>;
    checkLicense(license: string, adapterName: string): Promise<void>;
    renderAskForUpdate(): JSX.Element | null;
    _onClick(secondRun?: boolean): Promise<void>;
    renderItem(): JSX.Element;
}
export default ConfigCheckLicense;
