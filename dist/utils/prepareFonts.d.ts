export function fetchFont(name: any): any;
export const Fonts: {
    Roboto: {
        src: string;
        correction(size: any, lineHeight: any): number;
        subset: boolean;
    };
    'Noto Sans CJK': {
        src: string;
        correction(size: any, lineHeight: any): number;
        subset: boolean;
    };
};
export function fetchFontbyName(fontFamily: any): Promise<Response>;
