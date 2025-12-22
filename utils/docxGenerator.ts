
import * as docx from "docx";
import FileSaver from "file-saver";

interface DocxGeneratorParams {
  adText: string;
  reportMarkdown: string;
  adTextImagesBase64?: string[] | null;
  adCreativeImagesBase64?: string[] | null;
}

export const generateWordDocument = async ({
  adText,
  reportMarkdown,
  adTextImagesBase64,
  adCreativeImagesBase64,
}: DocxGeneratorParams) => {
  const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle, HeadingLevel, ImageRun } = docx;

  const children: (docx.Paragraph | docx.Table)[] = [];

  // --- 1. タイトル ---
  children.push(
    new Paragraph({
      text: "AI広告リーガルチェックレポート",
      heading: HeadingLevel.TITLE,
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `作成日: ${new Date().toLocaleString('ja-JP')}`,
          italics: true,
          color: "666666",
        }),
      ],
      spacing: { after: 400 },
    })
  );

  // --- 2. 広告内容セクション ---
  children.push(
    new Paragraph({
      text: "1. 審査対象広告内容",
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: "【広告テキスト】",
          bold: true,
        }),
      ],
      spacing: { after: 100 },
    }),
    new Paragraph({
      text: adText,
      border: {
        left: { style: BorderStyle.SINGLE, size: 4, space: 10, color: "CCCCCC" },
      },
      spacing: { after: 300 },
    })
  );

  // 画像があれば追加
  const addImagesToDoc = (images: string[] | null | undefined, title: string) => {
    if (images && images.length > 0) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: `【${title}】`, bold: true })],
          spacing: { before: 200, after: 100 },
        })
      );
      images.forEach((base64) => {
        try {
            // "data:image/png;base64," などを除去
            const parts = base64.split(',');
            const base64Data = parts[1];
            const mimeMatch = parts[0].match(/:(.*?);/);
            const mime = mimeMatch ? mimeMatch[1] : 'image/png';
            
            // docxのImageRunでサポートされている型に限定する (SVGはfallbackが必要なため除外)
            let imgType: "png" | "jpg" | "gif" | "bmp" = "png";
            if (mime.includes("jpeg") || mime.includes("jpg")) imgType = "jpg";
            else if (mime.includes("gif")) imgType = "gif";
            else if (mime.includes("bmp")) imgType = "bmp";
            // else if (mime.includes("svg")) imgType = "svg"; 

            children.push(
                new Paragraph({
                children: [
                    new ImageRun({
                    data: Uint8Array.from(atob(base64Data), c => c.charCodeAt(0)),
                    transformation: { width: 400, height: 400 }, // サイズは適宜調整
                    type: imgType,
                    }),
                ],
                spacing: { after: 200 },
                })
            );
        } catch (e) {
            console.error("画像追加エラー:", e);
        }
      });
    }
  };

  addImagesToDoc(adTextImagesBase64, "広告テキスト画像");
  addImagesToDoc(adCreativeImagesBase64, "広告クリエイティブ画像");


  // --- 3. AIチェック結果セクション (Markdown解析) ---
  children.push(
    new Paragraph({
      text: "2. AI審査レポート",
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 200 },
    })
  );

  const lines = reportMarkdown.split('\n');
  let tableBuffer: string[] = [];

  const processTableBuffer = () => {
    if (tableBuffer.length === 0) return;

    // 簡易的なMarkdownテーブルパーサー
    // | Header | Header |
    // | --- | --- |
    // | Cell | Cell |
    
    const rows = tableBuffer.filter(line => line.trim().startsWith('|'));
    if (rows.length < 3) return; // ヘッダー、区切り、データが最低限必要

    const tableRows: docx.TableRow[] = [];
    
    // ヘッダー処理
    const headerCells = rows[0].split('|').slice(1, -1).map(c => c.trim());
    tableRows.push(
      new TableRow({
        children: headerCells.map(text => 
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text, bold: true, color: "FFFFFF" })] })],
            shading: { fill: "4F46E5" }, // Purple/Blue header
            width: { size: 100 / headerCells.length, type: WidthType.PERCENTAGE },
            verticalAlign: docx.VerticalAlign.CENTER,
            margins: { top: 100, bottom: 100, left: 100, right: 100 },
          })
        ),
      })
    );

    // データ行処理 (1行目はヘッダー、2行目は区切り線なのでスキップ)
    for (let i = 2; i < rows.length; i++) {
      const cells = rows[i].split('|').slice(1, -1).map(c => c.trim());
      tableRows.push(
        new TableRow({
          children: cells.map(text => {
            const isNG = text.includes("NG") || text.includes("❌");
            return new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text,
                      color: isNG ? "FF0000" : "000000", // NGは赤文字
                      bold: isNG,
                    })
                  ]
                })
              ],
              width: { size: 100 / Math.max(headerCells.length, 1), type: WidthType.PERCENTAGE },
              margins: { top: 100, bottom: 100, left: 100, right: 100 },
            });
          }),
        })
      );
    }

    children.push(
      new Table({
        rows: tableRows,
        width: { size: 100, type: WidthType.PERCENTAGE },
        indent: { size: 100, type: WidthType.DXA },
      })
    );
    children.push(new Paragraph({ text: "" })); // テーブル後の改行
    tableBuffer = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line.startsWith('|')) {
      tableBuffer.push(line);
    } else {
      processTableBuffer(); // テーブル終了判定

      if (line.startsWith('## ')) {
        children.push(new Paragraph({
          text: line.replace(/^##\s+/, ''),
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 300, after: 100 },
        }));
      } else if (line.startsWith('### ')) {
        children.push(new Paragraph({
          text: line.replace(/^###\s+/, ''),
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 200, after: 100 },
        }));
      } else if (line !== '' && !line.startsWith('```') && !line.startsWith('=====')) {
        children.push(new Paragraph({
          text: line,
          spacing: { after: 100 },
        }));
      }
    }
  }
  processTableBuffer(); // 末尾に残っているテーブルがあれば処理

  // --- 4. 法務確認欄セクション ---
  children.push(
    new Paragraph({
      text: "",
      pageBreakBefore: true, // 改ページ
    }),
    new Paragraph({
      text: "3. 法務確認・判定欄",
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: "※本レポートはAIによる一次スクリーニング結果です。AIは厳しめに判定を行う傾向があります。最終的な掲載可否は、以下の法務担当者による判断を優先してください。",
          italics: true
        })
      ],
      spacing: { after: 300 },
    })
  );

  // 法務確認用テーブル
  const legalTable = new Table({
    rows: [
      new TableRow({
        children: [
          new TableCell({
            children: [
              new Paragraph({ 
                children: [
                  new TextRun({ text: "AI判定へのコメント\n(AIが厳しすぎる、誤判定である等のフィードバック)", bold: true })
                ]
              })
            ],
            width: { size: 30, type: WidthType.PERCENTAGE },
            shading: { fill: "EEEEEE" },
            verticalAlign: docx.VerticalAlign.CENTER,
          }),
          new TableCell({
            children: [
                new Paragraph({ text: "\n\n\n\n" }) // 書き込みスペース
            ], 
            width: { size: 70, type: WidthType.PERCENTAGE },
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: "修正指示事項\n(具体的に修正すべき文言等)", bold: true })
                ]
              })
            ],
            shading: { fill: "EEEEEE" },
            verticalAlign: docx.VerticalAlign.CENTER,
          }),
          new TableCell({
            children: [new Paragraph({ text: "\n\n\n\n" })],
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: "最終法務判定", bold: true })
                ]
              })
            ],
            shading: { fill: "EEEEEE" },
            verticalAlign: docx.VerticalAlign.CENTER,
          }),
          new TableCell({
            children: [new Paragraph({ text: "□ 承認 (修正なし)   □ 条件付き承認 (要修正)   □ 否認 (掲載不可)" })],
            verticalAlign: docx.VerticalAlign.CENTER,
            margins: { top: 200, bottom: 200, left: 200 },
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: "確認者 / 確認日", bold: true })
                ]
              })
            ],
            shading: { fill: "EEEEEE" },
            verticalAlign: docx.VerticalAlign.CENTER,
          }),
          new TableCell({
            children: [new Paragraph({ text: "氏名: ____________________   日付: ______年___月___日" })],
            verticalAlign: docx.VerticalAlign.CENTER,
            margins: { top: 200, bottom: 200, left: 200 },
          }),
        ],
      }),
    ],
    width: { size: 100, type: WidthType.PERCENTAGE },
  });

  children.push(legalTable);

  // ドキュメント生成
  const doc = new Document({
    sections: [{
      properties: {},
      children: children,
    }],
  });

  const blob = await Packer.toBlob(doc);
  // FileSaverのインポートエラー回避のためのフォールバック
  const saveAs = (FileSaver as any).saveAs || FileSaver;
  saveAs(blob, `AI広告チェックレポート_${new Date().toISOString().split('T')[0]}.docx`);
};
