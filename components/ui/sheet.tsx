"use client";

/*!
 * Adapted from shadcn/ui Sheet (MIT, Copyright (c) 2023 shadcn).
 * Source and provenance: ./sheet.LICENSE.md
 * Local adaptation: individual Radix package, left-only CSS Module styling,
 * existing icons/tokens, no animation library or extra component dependencies.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
import * as Dialog from "@radix-ui/react-dialog";
import type { ComponentProps, ReactNode } from "react";
import NavigationIcon from "@/components/dashboard/navigation-icon";
import styles from "./sheet.module.css";

type SheetProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onCloseAutoFocus?: ComponentProps<typeof Dialog.Content>["onCloseAutoFocus"];
    children: ReactNode;
};

export default function Sheet({ open, onOpenChange, onCloseAutoFocus, children }: SheetProps) {
    return <Dialog.Root open={open} onOpenChange={onOpenChange} modal>
        <Dialog.Portal>
            <Dialog.Overlay className={styles.overlay} data-navigation-backdrop="" />
            <Dialog.Content className={styles.content} aria-describedby={undefined} onCloseAutoFocus={onCloseAutoFocus}>
                <div className={styles.heading}>
                    <Dialog.Title>Navigation</Dialog.Title>
                    <Dialog.Close asChild><button type="button" aria-label="Close navigation menu" title="Close navigation menu"><NavigationIcon name="close" /></button></Dialog.Close>
                </div>
                {children}
            </Dialog.Content>
        </Dialog.Portal>
    </Dialog.Root>;
}
