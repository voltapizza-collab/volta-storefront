package com.volta.poslab;

import java.util.ArrayList;
import java.util.List;

/** 58 mm paper, 384-dot printable area; conservative 30-column text at size 24. */
public final class Receipt58 {
    public static List<String> wrap(String text) {
        List<String> result = new ArrayList<>();
        for (String paragraph : text.replace("\r", "").replace("\t", " ").split("\n", -1)) {
            String rest = paragraph.replaceAll("[\\p{Cc}]", "").trim();
            if (rest.isEmpty()) { result.add(""); continue; }
            while (!rest.isEmpty()) {
                int end=0, width=0, space=-1;
                while(end<rest.length()) {
                    int cp=rest.codePointAt(end), columns=cp<=255 || cp==0x20ac ? 1 : 2;
                    if(width+columns>30) break;
                    if(cp==' ') space=end;
                    width+=columns; end+=Character.charCount(cp);
                }
                if(end<rest.length() && space>0) end=space;
                result.add(rest.substring(0,end).trim()); rest=rest.substring(end).trim();
            }
        }
        return result;
    }
}
