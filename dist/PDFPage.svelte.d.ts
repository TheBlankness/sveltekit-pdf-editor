/** @typedef {typeof __propDef.props}  PdfPageProps */
/** @typedef {typeof __propDef.events}  PdfPageEvents */
/** @typedef {typeof __propDef.slots}  PdfPageSlots */
export default class PdfPage extends SvelteComponent<{
    page: any;
    zoom: any;
}, {
    measure: CustomEvent<any>;
} & {
    [evt: string]: CustomEvent<any>;
}, {}> {
}
export type PdfPageProps = typeof __propDef.props;
export type PdfPageEvents = typeof __propDef.events;
export type PdfPageSlots = typeof __propDef.slots;
import { SvelteComponent } from "svelte";
declare const __propDef: {
    props: {
        page: any;
        zoom: any;
    };
    events: {
        measure: CustomEvent<any>;
    } & {
        [evt: string]: CustomEvent<any>;
    };
    slots: {};
};
export {};
