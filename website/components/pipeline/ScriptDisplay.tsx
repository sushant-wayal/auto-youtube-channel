// "use client";

// import { useState } from "react";
// import { VideoScript } from "@/lib/pipeline/types";
// import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
// import { Badge } from "@/components/ui/badge";
// import { Button } from "@/components/ui/button";
// import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
// import { ScrollArea } from "@/components/ui/scroll-area";
// import { Separator } from "@/components/ui/separator";
// import { FileText, Tag, Zap, Copy, Check } from "lucide-react";

// interface ScriptDisplayProps {
//     script: VideoScript;
//     onExport?: () => void;
//     onReset?: () => void;
// }

// export default function ScriptDisplay({ script, onExport, onReset }: ScriptDisplayProps) {
//     const [copiedNarration, setCopiedNarration] = useState(false);

//     const copyToClipboard = async (text: string) => {
//         try {
//             await navigator.clipboard.writeText(text);
//             setCopiedNarration(true);
//             setTimeout(() => setCopiedNarration(false), 2000);
//         } catch (err) {
//             console.error("Failed to copy:", err);
//         }
//     };

//     const formatNarration = (narration: string) => {
//         return narration.split("\n\n").map((paragraph, index) => (
//             <p key={index} className="mb-4 last:mb-0">
//                 {paragraph.split("[PAUSE]").map((segment, i, arr) => (
//                     <span key={i}>
//                         {segment}
//                         {i < arr.length - 1 && (
//                             <span className="inline-flex items-center mx-2 px-2 py-0.5 rounded bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400 text-xs font-mono">
//                                 [PAUSE]
//                             </span>
//                         )}
//                     </span>
//                 ))}
//             </p>
//         ));
//     };

//     const estimateWordCount = (text: string) => {
//         return text.trim().split(/\s+/).length;
//     };

//     return (
//         <Card className="shadow-xl border-2 animate-in fade-in slide-in-from-bottom-4 duration-700">
//             <CardHeader>
//                 <div className="flex items-start justify-between">
//                     <div className="space-y-1 flex-1">
//                         <CardTitle className="flex items-center gap-2 text-2xl">
//                             <FileText className="w-6 h-6 text-green-500" />
//                             {script.title}
//                         </CardTitle>
//                         <CardDescription className="text-base">
//                             {script.description}
//                         </CardDescription>
//                     </div>
//                     <Badge variant="secondary" className="ml-4">
//                         {estimateWordCount(script.narration)} words
//                     </Badge>
//                 </div>
//             </CardHeader>
//             <CardContent className="space-y-6">
//                 {/* Tags */}
//                 <div className="space-y-2">
//                     <div className="flex items-center gap-2 text-sm font-medium">
//                         <Tag className="w-4 h-4" />
//                         SEO Tags
//                     </div>
//                     <div className="flex flex-wrap gap-2">
//                         {script.tags.map((tag, index) => (
//                             <Badge key={index} variant="outline">
//                                 {tag}
//                             </Badge>
//                         ))}
//                     </div>
//                 </div>

//                 <Separator />

//                 {/* Script Content */}
//                 <Accordion type="single" collapsible className="w-full" defaultValue="narration">
//                     {/* Main Narration */}
//                     <AccordionItem value="narration">
//                         <AccordionTrigger className="text-left">
//                             <div className="flex items-center gap-2">
//                                 <Badge className="bg-blue-500">Main Script</Badge>
//                                 <span className="font-semibold">Full Narration</span>
//                             </div>
//                         </AccordionTrigger>
//                         <AccordionContent>
//                             <div className="space-y-4">
//                                 <div className="bg-muted rounded-lg p-6">
//                                     <div className="flex items-center justify-between mb-4">
//                                         <p className="text-xs font-semibold text-muted-foreground uppercase">
//                                             Ready for AI Voiceover
//                                         </p>
//                                         <Button
//                                             variant="ghost"
//                                             size="sm"
//                                             onClick={() => copyToClipboard(script.narration)}
//                                         >
//                                             {copiedNarration ? (
//                                                 <>
//                                                     <Check className="w-4 h-4 mr-2" />
//                                                     Copied!
//                                                 </>
//                                             ) : (
//                                                 <>
//                                                     <Copy className="w-4 h-4 mr-2" />
//                                                     Copy
//                                                 </>
//                                             )}
//                                         </Button>
//                                     </div>
//                                     <ScrollArea className="h-[300px] pr-4">
//                                         <div className="text-base leading-relaxed space-y-4">
//                                             {formatNarration(script.narration)}
//                                         </div>
//                                     </ScrollArea>
//                                 </div>
//                             </div>
//                         </AccordionContent>
//                     </AccordionItem>

//                     {/* YouTube Shorts */}
//                     {script.shorts && script.shorts.length > 0 && (
//                         <AccordionItem value="shorts">
//                             <AccordionTrigger className="text-left">
//                                 <div className="flex items-center gap-2">
//                                     <Badge className="bg-purple-500">Bonus</Badge>
//                                     <span className="font-semibold">
//                                         YouTube Shorts ({script.shorts.length})
//                                     </span>
//                                     <Zap className="w-4 h-4 text-yellow-500" />
//                                 </div>
//                             </AccordionTrigger>
//                             <AccordionContent>
//                                 <div className="space-y-4">
//                                     {script.shorts.map((short, index) => (
//                                         <div
//                                             key={index}
//                                             className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg p-4 border border-purple-200 dark:border-purple-800"
//                                         >
//                                             <div className="flex items-center justify-between mb-3">
//                                                 <Badge variant="secondary">Short {index + 1}</Badge>
//                                                 <span className="text-xs text-muted-foreground">15-20s</span>
//                                             </div>

//                                             {/* Hook */}
//                                             <div className="mb-3">
//                                                 <p className="text-xs font-semibold text-purple-700 dark:text-purple-400 mb-1 uppercase">
//                                                     Hook
//                                                 </p>
//                                                 <p className="text-sm font-medium">{short.hook}</p>
//                                             </div>

//                                             {/* Script */}
//                                             <div>
//                                                 <p className="text-xs font-semibold text-purple-700 dark:text-purple-400 mb-1 uppercase">
//                                                     Script
//                                                 </p>
//                                                 <p className="text-sm leading-relaxed">{short.script}</p>
//                                             </div>
//                                         </div>
//                                     ))}
//                                 </div>
//                             </AccordionContent>
//                         </AccordionItem>
//                     )}
//                 </Accordion>

//                 {/* Action Buttons */}
//                 {(onExport || onReset) && (
//                     <div className="flex gap-3 pt-4">
//                         {onExport && (
//                             <Button variant="outline" className="flex-1" onClick={onExport}>
//                                 <FileText className="w-4 h-4 mr-2" />
//                                 Export Script
//                             </Button>
//                         )}
//                         {onReset && (
//                             <Button variant="outline" className="flex-1" onClick={onReset}>
//                                 Create New Video
//                             </Button>
//                         )}
//                     </div>
//                 )}
//             </CardContent>
//         </Card>
//     );
// }
