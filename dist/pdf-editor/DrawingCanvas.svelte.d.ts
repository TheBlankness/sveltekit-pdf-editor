/** @typedef {typeof __propDef.props}  DrawingCanvasProps */
/** @typedef {typeof __propDef.events}  DrawingCanvasEvents */
/** @typedef {typeof __propDef.slots}  DrawingCanvasSlots */
export default class DrawingCanvas extends SvelteComponent<{
    page: any;
    pageScale: any;
    brushSize: any;
    brushColor: any;
}, {
    finish: CustomEvent<any>;
} & {
    [evt: string]: CustomEvent<any>;
}, {}> {
}
export type DrawingCanvasProps = typeof __propDef.props;
export type DrawingCanvasEvents = typeof __propDef.events;
export type DrawingCanvasSlots = typeof __propDef.slots;
import { SvelteComponent } from "svelte";
declare const __propDef: {
    props: {
        page: any;
        pageScale: any;
        brushSize: any;
        brushColor: any;
    };
    events: {
        finish: CustomEvent<any>;
    } & {
        [evt: string]: CustomEvent<any>;
    };
    slots: {};
};
export {};
