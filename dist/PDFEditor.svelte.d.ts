/** @typedef {typeof __propDef.props}  PdfEditorProps */
/** @typedef {typeof __propDef.events}  PdfEditorEvents */
/** @typedef {typeof __propDef.slots}  PdfEditorSlots */
export default class PdfEditor extends SvelteComponent<{
    pdfBlob: any;
    allObjects?: any[] | undefined;
    allowPrinting?: boolean | undefined;
}, {
    done: CustomEvent<any>;
    dataUpdated: CustomEvent<any>;
} & {
    [evt: string]: CustomEvent<any>;
}, {}> {
}
export type PdfEditorProps = typeof __propDef.props;
export type PdfEditorEvents = typeof __propDef.events;
export type PdfEditorSlots = typeof __propDef.slots;
import { SvelteComponent } from "svelte";
declare const __propDef: {
    props: {
        pdfBlob: any;
        allObjects?: any[] | undefined;
        allowPrinting?: boolean | undefined;
    };
    events: {
        done: CustomEvent<any>;
        dataUpdated: CustomEvent<any>;
    } & {
        [evt: string]: CustomEvent<any>;
    };
    slots: {};
};
export {};
