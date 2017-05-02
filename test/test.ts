//import { suite, test, slow, timeout, skip, only } from "mocha-typescript";
//declare function require(name:string):any;
import { suite, test } from "mocha-typescript";
import cssBlocks = require("../src/cssBlocks");
import { assert } from "chai";
import { PluginOptions, OptionsReader } from "../src/Options";
import { ImportedFile, Importer } from "../src/importing";

import * as postcss from "postcss";
import * as perfectionist from "perfectionist";
import * as path from "path";

const PROJECT_DIR = path.resolve(__dirname, "../..");

@suite("Setting up")
export class SetupTests {
  @test "options are optional"() {
    let cssBlocksPlugin = cssBlocks(postcss);
    let processor = cssBlocksPlugin();
    assert(processor);
  }
  @test "default options"() {
    const reader = new OptionsReader({});
    assert.equal(reader.outputMode, cssBlocks.OutputMode.BEM);
    assert.equal(reader.outputModeName, "BEM");
  }
  @test "a filename is required"() {
    let cssBlocksPlugin = cssBlocks(postcss);
    let processor = cssBlocksPlugin();
    let inputCSS = `:block {color: red;}`;
    return postcss([
      processor
    ]).process(inputCSS, {}).then(() => {
      assert(false, "Error was not raised.");
    }).catch((reason) => {
      assert(reason instanceof cssBlocks.CssBlockError);
      assert(reason instanceof cssBlocks.MissingSourcePath);
      assert.equal(reason.message, "PostCSS `from` option is missing. The source filename is required for CSS Blocks to work correctly.");
    });

  }
}

export class BEMProcessor {
  process(filename: string, contents: string, cssBlocksOpts?: PluginOptions) {
    let processOpts = { from: filename };
    let cssBlocksProcessor = cssBlocks(postcss)
    return postcss([
      cssBlocksProcessor(cssBlocksOpts),
      perfectionist({format: "compact", indentSize: 2})
    ]).process(contents, processOpts);
  }
}
 
@suite("In BEM output mode")
export class BEMOutputMode extends BEMProcessor {
  @test "replaces block with the blockname from the file"() {
    let filename = "foo/bar/test-block.css";
    let inputCSS = `:block {color: red;}`;
    return this.process(filename, inputCSS).then((result) => {
      assert.equal(
        result.css.toString(),
        ".test-block { color: red; }\n"
      );
    });
  }

  @test "handles pseudoclasses on the :block"() {
    let filename = "foo/bar/test-block-pseudos.css";
    let inputCSS = `:block {color: #111;}
                    :block:hover { font-weight: bold; }`;
    return this.process(filename, inputCSS).then((result) => {
      assert.equal(
        result.css.toString(),
        ".test-block-pseudos { color: #111; }\n" +
        ".test-block-pseudos:hover { font-weight: bold; }\n"
      );
    });
  }

  @test "handles :states"() {
    let filename = "foo/bar/test-state.css";
    let inputCSS = `:block {color: #111;}
                    :state(big) { transform: scale(2); }`;
    return this.process(filename, inputCSS).then((result) => {
      assert.equal(
        result.css.toString(),
        ".test-state { color: #111; }\n" +
        ".test-state--big { transform: scale( 2 ); }\n"
      );
    });
  }

  @test "handles comma-delimited :states"() {
    let filename = "foo/bar/test-state.css";
    let inputCSS = `:state(big), :state(really-big) { transform: scale(2); }`;
    return this.process(filename, inputCSS).then((result) => {
      assert.equal(
        result.css.toString(),
        ".test-state--big, .test-state--really-big { transform: scale( 2 ); }\n"
      );
    });
  }

  @test "a state can be combined with itself"() {
    let filename = "foo/bar/self-combinator.css";
    let inputCSS = `:state(big) + :state(big)::after { content: "" }`;
    return this.process(filename, inputCSS).then((result) => {
      assert.equal(
        result.css.toString(),
        ".self-combinator--big + .self-combinator--big::after { content: \"\"; }\n"
      );
    });
  }

  @test "handles exclusive :states"() {
    let filename = "foo/bar/test-state.css";
    let inputCSS = `:block {color: #111;}
                    :state(font big) { transform: scale(2); }`;
    return this.process(filename, inputCSS).then((result) => {
      assert.equal(
        result.css.toString(),
        ".test-state { color: #111; }\n" +
        ".test-state--font-big { transform: scale( 2 ); }\n"
      );
    });
  }

  @test "handles comma-delimited exclusive :states"() {
    let filename = "foo/bar/test-state.css";
    let inputCSS = `:state(font big), :state(font really-big) { transform: scale(2); }`;
    return this.process(filename, inputCSS).then((result) => {
      assert.equal(
        result.css.toString(),
        ".test-state--font-big, .test-state--font-really-big { transform: scale( 2 ); }\n"
      );
    });
  }

  @test "a exclusive state can be combined with itself"() {
    let filename = "foo/bar/self-combinator.css";
    let inputCSS = `:state(font big) + :state(font big)::after { content: "" }`;
    return this.process(filename, inputCSS).then((result) => {
      assert.equal(
        result.css.toString(),
        ".self-combinator--font-big + .self-combinator--font-big::after { content: \"\"; }\n"
      );
    });
  }

  @test "handles elements"() {
    let filename = "foo/bar/test-element.css";
    let inputCSS = `:block {color: #111;}
                    .my-element { display: block; }`;
    return this.process(filename, inputCSS).then((result) => {
      assert.equal(
        result.css.toString(),
        ".test-element { color: #111; }\n" +
        ".test-element__my-element { display: block; }\n"
      );
    });
  }

  @test "handles elements with states"() {
    let filename = "foo/bar/stateful-element.css";
    let inputCSS = `:block {color: #111;}
                    .my-element { display: none; }
                    :state(visible) .my-element { display: block; }`;
    return this.process(filename, inputCSS).then((result) => {
      assert.equal(
        result.css.toString(),
        ".stateful-element { color: #111; }\n" +
        ".stateful-element__my-element { display: none; }\n" +
        ".stateful-element--visible .stateful-element__my-element { display: block; }\n"
      );
    });
  }

  @test "handles elements with substates"() {
    let filename = "foo/bar/stateful-element.css";
    let inputCSS = `:block {color: #111;}
                    .my-element { display: none; }
                    .my-element:substate(visible) { display: block; }`;
    return this.process(filename, inputCSS).then((result) => {
      assert.equal(
        result.css.toString(),
        ".stateful-element { color: #111; }\n" +
        ".stateful-element__my-element { display: none; }\n" +
        ".stateful-element__my-element--visible { display: block; }\n"
      );
    });
  }
}


@suite("Block Syntax")
export class StraightJacket extends BEMProcessor {
  assertError(errorType: typeof cssBlocks.CssBlockError, message: string, promise: postcss.LazyResult) {
    return promise.then(
      () => {
        assert(false, `Error ${errorType.name} was not raised.`);
      },
      (reason) => {
        assert(reason instanceof errorType, reason.toString());
        assert.equal(reason.message, message);
      });
  }

  @test "catches invalid :states"() {
    let filename = "foo/bar/test-state.css";
    let inputCSS = `:block {color: #111;}
                    :state() { transform: scale(2); }`;
    return this.assertError(
      cssBlocks.InvalidBlockSyntax,
      "Invalid state declaration: :state() (foo/bar/test-state.css:2:21)",
      this.process(filename, inputCSS));
  }

  @test "cannot combine two different :states"() {
    let filename = "foo/bar/illegal-state-combinator.css";
    let inputCSS = `:state(a) :state(b) { float: left; }`;
    return this.assertError(
      cssBlocks.InvalidBlockSyntax,
      "Distinct states cannot be combined: :state(a) :state(b)" +
        " (foo/bar/illegal-state-combinator.css:1:1)",
      this.process(filename, inputCSS))
  }

  @test "cannot combine two different exclusive :states"() {
    let filename = "foo/bar/illegal-state-combinator.css";
    let inputCSS = `:state(a) :state(exclusive b) { float: left; }`;
    return this.assertError(
      cssBlocks.InvalidBlockSyntax,
      "Distinct states cannot be combined: :state(a) :state(exclusive b)" +
        " (foo/bar/illegal-state-combinator.css:1:1)",
      this.process(filename, inputCSS));
  }

  @test "disallows combining elements"() {
    let filename = "foo/bar/illegal-element-combinator.css";
    let inputCSS = `:block {color: #111;}
                    .my-element .another-element { display: block; }`;
    return this.assertError(
      cssBlocks.InvalidBlockSyntax,
      "Distinct elements cannot be combined: .my-element .another-element" +
        " (foo/bar/illegal-element-combinator.css:2:21)",
      this.process(filename, inputCSS));
  }

  @test "disallows combining elements without a combinator"() {
    let filename = "foo/bar/illegal-element-combinator.css";
    let inputCSS = `:block {color: #111;}
                    .my-element.another-element { display: block; }`;
    return this.assertError(
      cssBlocks.InvalidBlockSyntax,
      "Distinct elements cannot be combined: .my-element.another-element" +
        " (foo/bar/illegal-element-combinator.css:2:21)",
      this.process(filename, inputCSS));
  }

  @test "disallows combining states and elements without a combinator"() {
    let filename = "foo/bar/illegal-element-combinator.css";
    let inputCSS = `:block {color: #111;}
                    :state(foo).another-element { display: block; }`;
    return this.assertError(
      cssBlocks.InvalidBlockSyntax,
      "Cannot have state and element on the same DOM element: :state(foo).another-element" +
        " (foo/bar/illegal-element-combinator.css:2:21)",
      this.process(filename, inputCSS));
  }
  @test "disallows combining blocks and elements without a combinator"() {
    let filename = "foo/bar/illegal-element-combinator.css";
    let inputCSS = `:block {color: #111;}
                    :block.another-element { display: block; }`;
    return this.assertError(
      cssBlocks.InvalidBlockSyntax,
      "Cannot have block and element on the same DOM element: :block.another-element" +
        " (foo/bar/illegal-element-combinator.css:2:21)",
      this.process(filename, inputCSS));
  }
  @test "disallows combining states and block without a combinator"() {
    let filename = "foo/bar/illegal-element-combinator.css";
    let inputCSS = `:block {color: #111;}
                    :block:state(foo) { display: block; }`;
    return this.assertError(
      cssBlocks.InvalidBlockSyntax,
      "It's redundant to specify state with block: :block:state(foo)" +
        " (foo/bar/illegal-element-combinator.css:2:21)",
      this.process(filename, inputCSS));
  }
  @test "disallows !important"() {
    let filename = "foo/bar/no-important.css";
    let inputCSS = `:block {color: #111 !important;}`;
    return this.assertError(
      cssBlocks.InvalidBlockSyntax,
      "!important is not allowed for `color` in `:block` (foo/bar/no-important.css:1:9)",
      this.process(filename, inputCSS));
  }
}

@suite("Interoperable CSS")
export class InteroperableCSSOutput extends BEMProcessor {
  @test "exports block name"() {
    let filename = "foo/bar/test-block.css";
    let inputCSS = `:block {color: red;}`;
    return this.process(filename, inputCSS, {interoperableCSS: true}).then((result) => {
      assert.equal(
        result.css.toString(),
        ":export { block: test-block; }\n" +
        ".test-block { color: red; }\n"
      );
    });
  }
  @test "exports state names"() {
    let filename = "foo/bar/test-block.css";
    let inputCSS = `:state(red) {color: red;}
                    :state(theme blue) {color: blue;}`;
    return this.process(filename, inputCSS, {interoperableCSS: true}).then((result) => {
      assert.equal(
        result.css.toString(),
        ":export { block: test-block; theme-blue: test-block--theme-blue; red: test-block--red; }\n" +
        ".test-block--red { color: red; }\n" +
        ".test-block--theme-blue { color: blue; }\n"
      );
    });
  }
  @test "exports element names"() {
    let filename = "foo/bar/test-block.css";
    let inputCSS = `.a {color: red;}
                    .b {color: blue;}`;
    return this.process(filename, inputCSS, {interoperableCSS: true}).then((result) => {
      assert.equal(
        result.css.toString(),
        ":export { block: test-block; a: test-block__a; b: test-block__b; }\n" +
        ".test-block__a { color: red; }\n" +
        ".test-block__b { color: blue; }\n"
      );
    });
  }
  @test "exports element states"() {
    let filename = "foo/bar/test-block.css";
    let inputCSS = `.a:substate(big) {color: red;}
                    .b:substate(big) {color: blue;}`;
    return this.process(filename, inputCSS, {interoperableCSS: true}).then((result) => {
      assert.equal(
        result.css.toString(),
        ":export { block: test-block; a: test-block__a; a--big: test-block__a--big; b: test-block__b; b--big: test-block__b--big; }\n" +
        ".test-block__a--big { color: red; }\n" +
        ".test-block__b--big { color: blue; }\n"
      );
    });
  }
}

@suite("Block References")
export class BlockReferences extends BEMProcessor {
  @test "can import another block"() {
    let filename = "foo/bar/test-block.css";
    let inputCSS = `@block-reference "./imported.css";
                    @block-debug imported to comment;
                    :block { color: red; }
                    .b:substate(big) {color: blue;}`;

    let importer: Importer = (fromFile: string, importPath: string) => {
      return new Promise<ImportedFile>((resolve) => {
        assert.equal(fromFile, filename);
        assert.equal(importPath, "./imported.css");
        resolve({
          path: path.resolve(fromFile, importPath),
          contents: `:block { color: purple; }
                     :state(large) { font-size: 20px; }
                     :state(theme red) { color: red; }
                     .foo   { float: left;   }
                     .foo:substate(small) { font-size: 5px; }
                     .foo:substate(font fancy) { font-family: fancy; }`
        });
      });
    };
    return this.process(filename, inputCSS, {importer: importer}).then((result) => {
      assert.equal(
        result.css.toString(),
        `/* Source: ${PROJECT_DIR}/foo/bar/test-block.css/imported.css\n` +
        "   :block => .imported\n" +
        "   :state(theme red) => .imported--theme-red\n" +
        "   :state(large) => .imported--large\n" +
        "   .foo => .imported__foo\n" +
        "   .foo:substate(font fancy) => .imported__foo--font-fancy\n" +
        "   .foo:substate(small) => .imported__foo--small */\n" +
        ".test-block { color: red; }\n" +
        ".test-block__b--big { color: blue; }\n"
      );
    });
  }
}

@suite("Block Inheritance")
export class BlockInheritance extends BEMProcessor {
  @test "can import another block"() {
    let filename = "foo/bar/inherits.css";
    let inputCSS = `@block-reference "./base.css";
                    :block { extends: base; color: red; }
                    .foo { clear: both; }
                    .b:substate(small) {color: blue;}`;

    let importer: Importer = (fromFile: string, importPath: string) => {
      return new Promise<ImportedFile>((resolve) => {
        assert.equal(fromFile, filename);
        assert.equal(importPath, "./base.css");
        resolve({
          path: path.resolve(fromFile, importPath),
          contents: `:block { color: purple; }
                     :state(large) { font-size: 20px; }
                     .foo   { float: left;   }
                     .foo:substate(small) { font-size: 5px; }`
        });
      });
    };
    return this.process(filename, inputCSS, {interoperableCSS: true, importer: importer}).then((result) => {
      assert.equal(
        result.css.toString(),
        ":export {" +
        " block: inherits base;" +
        " foo: inherits__foo base__foo;" +
        " b: inherits__b;" +
        " b--small: inherits__b--small;" +
        " large: base--large;" +
        " foo--small: base__foo--small; " +
        "}\n" +
        ".inherits { color: red; }\n" +
        ".inherits__foo { clear: both; }\n" +
        ".inherits__b--small { color: blue; }\n"
      );
    });
  }
}