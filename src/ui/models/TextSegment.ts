import {TextSegmentType} from "../enums/TextSegmentType.ts";
import {HtmlPropertyValue, TypeOrSignal} from "@targoninc/jess";

export interface TextSegment {
    text: HtmlPropertyValue;
    type: TypeOrSignal<TextSegmentType>;
}