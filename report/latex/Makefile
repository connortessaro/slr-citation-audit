TEX        := report.tex
PDF        := report.pdf
LATEXMK    := latexmk -pdf -interaction=nonstopmode -file-line-error
BIB_HELPER := python3 build_bibtex.py
CLEAN_EXT  := aux bbl blg fdb_latexmk fls log out toc synctex.gz

.PHONY: all bib clean distclean

all: $(PDF)

$(PDF): $(TEX) references.bib
	$(LATEXMK) $(TEX)

bib:
	$(BIB_HELPER)

clean:
	$(foreach ext,$(CLEAN_EXT),rm -f *.$(ext);)

distclean: clean
	rm -f $(PDF)
